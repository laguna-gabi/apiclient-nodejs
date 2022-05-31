import { Identifier, MemberRole, RoleTypes, UserRole } from '@argus/hepiusClient';
import { TodoInternalKey, generateDispatchId } from '@argus/irisClient';
import { NotificationType } from '@argus/pandora';
import { UseInterceptors } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { camelCase } from 'lodash';
import {
  ActionTodoLabel,
  CreateActionTodoParams,
  CreateTodoDoneParams,
  CreateTodoParams,
  ExtraTodoParams,
  GetTodoDonesParams,
  Label,
  Todo,
  TodoDone,
  TodoLabel,
  TodoNotificationsType,
  TodoService,
  TodoStatus,
  UpdateTodoParams,
} from '.';
import {
  Client,
  ErrorType,
  Errors,
  EventType,
  IInternalDispatch,
  IsValidObjectId,
  LoggerService,
  LoggingInterceptor,
  MemberIdParam,
  MemberIdParamType,
  MemberUserRouteInterceptor,
  Roles,
  generatePath,
  getCorrelationId,
} from '../common';
import { JourneyService } from '../journey';

@UseInterceptors(LoggingInterceptor)
@Resolver(() => Todo)
export class TodoResolver {
  constructor(
    private readonly todoService: TodoService,
    private readonly journeyService: JourneyService,
    readonly eventEmitter: EventEmitter2,
    readonly logger: LoggerService,
  ) {}

  @Mutation(() => Identifier)
  @MemberIdParam(MemberIdParamType.memberId)
  @UseInterceptors(MemberUserRouteInterceptor)
  @Roles(UserRole.lagunaCoach, UserRole.lagunaNurse, MemberRole.member)
  async createTodo(
    @Client('roles') roles,
    @Client('_id') clientId,
    @Args(camelCase(CreateTodoParams.name)) createTodoParams: CreateTodoParams,
  ) {
    const { id: journeyId } = await this.journeyService.getRecent(createTodoParams.memberId);
    const status = this.getTodoStatus(createTodoParams, roles);
    const todo = await this.todoService.createTodo({
      ...createTodoParams,
      status,
      journeyId,
    });
    this.todoSendNotification(todo, roles, clientId, 'createTodo');
    return { id: todo.id };
  }

  @Mutation(() => Identifier)
  @Roles(UserRole.lagunaCoach, UserRole.lagunaNurse)
  async createActionTodo(
    @Client('roles') roles,
    @Client('_id') clientId,
    @Args(camelCase(CreateActionTodoParams.name)) createActionTodoParams: CreateActionTodoParams,
  ) {
    const { id: journeyId } = await this.journeyService.getRecent(createActionTodoParams.memberId);
    const todo = await this.todoService.createActionTodo({ ...createActionTodoParams, journeyId });
    this.todoSendNotification(todo, roles, clientId, 'createActionTodo');
    return { id: todo.id };
  }

  @Query(() => [Todo])
  @MemberIdParam(MemberIdParamType.memberId)
  @UseInterceptors(MemberUserRouteInterceptor)
  @Roles(UserRole.lagunaCoach, UserRole.lagunaNurse, MemberRole.member)
  async getTodos(
    @Args(
      'memberId',
      { type: () => String, nullable: true },
      new IsValidObjectId(Errors.get(ErrorType.memberIdInvalid), { nullable: true }),
    )
    memberId?: string,
  ) {
    const { id: journeyId } = await this.journeyService.getRecent(memberId);
    return this.todoService.getTodos(memberId, journeyId);
  }

  @Mutation(() => Todo)
  @MemberIdParam(MemberIdParamType.memberId)
  @UseInterceptors(MemberUserRouteInterceptor)
  @Roles(UserRole.lagunaCoach, UserRole.lagunaNurse, MemberRole.member)
  async updateTodo(
    @Client('roles') roles,
    @Client('_id') clientId,
    @Args(camelCase(UpdateTodoParams.name)) updateTodoParams: UpdateTodoParams,
  ) {
    const { id: journeyId } = await this.journeyService.getRecent(updateTodoParams.memberId);
    const status = this.getTodoStatus(updateTodoParams, roles);
    const todo = await this.todoService.updateTodo({
      ...updateTodoParams,
      status,
      journeyId,
    });
    this.todoSendNotification(todo, roles, clientId, 'updateTodo');
    return todo;
  }

  @Mutation(() => Boolean)
  @Roles(UserRole.lagunaCoach, UserRole.lagunaNurse, MemberRole.member)
  async endTodo(
    @Client('_id') clientId,
    @Client('roles') roles,
    @Args('id', { type: () => String }, new IsValidObjectId(Errors.get(ErrorType.todoIdInvalid)))
    id: string,
  ) {
    if (roles.includes(MemberRole.member)) {
      const { id: journeyId } = await this.journeyService.getRecent(clientId);
      const todo = await this.todoService.getTodo(id, clientId, journeyId);
      if (this.todoService.isActionTodo(todo)) {
        throw new Error(Errors.get(ErrorType.todoEndActionTodo));
      }
    }
    const todo = await this.todoService.endTodo(id, clientId);
    this.todoSendNotification(todo, roles, clientId, 'deleteTodo');
    return true;
  }

  @Mutation(() => Boolean)
  @Roles(MemberRole.member)
  async approveTodo(
    @Client('roles') roles,
    @Client('_id') memberId,
    @Args('id', { type: () => String }, new IsValidObjectId(Errors.get(ErrorType.todoIdInvalid)))
    id: string,
  ) {
    if (!roles.includes(MemberRole.member)) {
      throw new Error(Errors.get(ErrorType.memberAllowedOnly));
    }
    const { id: journeyId } = await this.journeyService.getRecent(memberId);
    return this.todoService.approveTodo(id, memberId, journeyId);
  }

  @Mutation(() => Identifier)
  @MemberIdParam(MemberIdParamType.memberId)
  @UseInterceptors(MemberUserRouteInterceptor)
  @Roles(MemberRole.member)
  async createTodoDone(
    @Client('roles') roles,
    @Args(camelCase(CreateTodoDoneParams.name)) createTodoDoneParams: CreateTodoDoneParams,
  ) {
    if (!roles.includes(MemberRole.member)) {
      throw new Error(Errors.get(ErrorType.memberAllowedOnly));
    }
    const { id: journeyId } = await this.journeyService.getRecent(createTodoDoneParams.memberId);
    return this.todoService.createTodoDone({ ...createTodoDoneParams, journeyId });
  }

  @Query(() => [TodoDone])
  @MemberIdParam(MemberIdParamType.memberId)
  @UseInterceptors(MemberUserRouteInterceptor)
  @Roles(UserRole.lagunaCoach, UserRole.lagunaNurse, MemberRole.member)
  async getTodoDones(
    @Args(camelCase(GetTodoDonesParams.name)) getTodoDonesParams: GetTodoDonesParams,
  ) {
    const { id: journeyId } = await this.journeyService.getRecent(getTodoDonesParams.memberId);
    return this.todoService.getTodoDones({ ...getTodoDonesParams, journeyId });
  }

  @Mutation(() => Boolean)
  @Roles(MemberRole.member)
  async deleteTodoDone(
    @Client('roles') roles,
    @Client('_id') memberId,
    @Args(
      'id',
      { type: () => String },
      new IsValidObjectId(Errors.get(ErrorType.todoDoneIdInvalid)),
    )
    id: string,
  ) {
    if (!roles.includes(MemberRole.member)) {
      throw new Error(Errors.get(ErrorType.memberAllowedOnly));
    }
    const { id: journeyId } = await this.journeyService.getRecent(memberId);
    return this.todoService.deleteTodoDone(id, memberId, journeyId);
  }

  /*************************************************************************************************
   ******************************************** Helpers ********************************************
   ************************************************************************************************/

  private getTodoStatus(params: ExtraTodoParams, roles: RoleTypes): TodoStatus {
    return (roles.includes(UserRole.lagunaCoach) ||
      roles.includes(UserRole.lagunaNurse) ||
      roles.includes(UserRole.lagunaAdmin)) &&
      params.label === TodoLabel.Meds
      ? TodoStatus.requested
      : TodoStatus.active;
  }

  private todoSendNotification(
    todo: Todo,
    roles: RoleTypes,
    clientId: string,
    todoNotificationsType: TodoNotificationsType,
  ) {
    if (
      roles.includes(UserRole.lagunaCoach) ||
      roles.includes(UserRole.lagunaNurse) ||
      roles.includes(UserRole.lagunaAdmin)
    ) {
      const contentKey = this.extractContentType(todoNotificationsType, todo.label);
      const createTodoEvent: IInternalDispatch = {
        correlationId: getCorrelationId(this.logger),
        dispatchId: generateDispatchId(contentKey, todo.memberId.toString(), todo.id),
        notificationType: NotificationType.text,
        recipientClientId: todo.memberId.toString(),
        senderClientId: clientId,
        contentKey,
        path: generatePath(NotificationType.text, contentKey),
      };
      this.eventEmitter.emit(EventType.notifyDispatch, createTodoEvent);
    }
  }

  extractContentType(todoNotificationsType: TodoNotificationsType, label?: Label): TodoInternalKey {
    if (todoNotificationsType === 'createTodo') {
      switch (label) {
        case TodoLabel.Appointment:
          return TodoInternalKey.createTodoAppointment;
        case TodoLabel.Meds:
          return TodoInternalKey.createTodoMeds;
        default:
          return TodoInternalKey.createTodoTodo;
      }
    } else if (todoNotificationsType === 'createActionTodo') {
      switch (label) {
        case ActionTodoLabel.Questionnaire:
          return TodoInternalKey.createTodoQuestionnaire;
        case ActionTodoLabel.Explore:
          return TodoInternalKey.createTodoExplore;
        default:
          return TodoInternalKey.createTodoTodo;
      }
    } else if (todoNotificationsType === 'updateTodo') {
      switch (label) {
        case TodoLabel.Appointment:
          return TodoInternalKey.updateTodoAppointment;
        case TodoLabel.Meds:
          return TodoInternalKey.updateTodoMeds;
        default:
          return TodoInternalKey.updateTodoTodo;
      }
    } else if (todoNotificationsType === 'deleteTodo') {
      switch (label) {
        case TodoLabel.Appointment:
          return TodoInternalKey.deleteTodoAppointment;
        case TodoLabel.Meds:
          return TodoInternalKey.deleteTodoMeds;
        default:
          return TodoInternalKey.deleteTodoTodo;
      }
    }
  }
}
