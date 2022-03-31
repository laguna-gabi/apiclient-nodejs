import { NotificationType, TodoInternalKey, generateDispatchId } from '@argus/pandora';
import { UseInterceptors } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { camelCase } from 'lodash';
import {
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
  Identifier,
  IsValidObjectId,
  LoggerService,
  LoggingInterceptor,
  MemberIdParam,
  MemberIdParamType,
  MemberRole,
  MemberUserRouteInterceptor,
  RoleTypes,
  Roles,
  UserRole,
  generatePath,
  getCorrelationId,
} from '../common';

@UseInterceptors(LoggingInterceptor)
@Resolver(() => Todo)
export class TodoResolver {
  constructor(
    private readonly todoService: TodoService,
    readonly eventEmitter: EventEmitter2,
    readonly logger: LoggerService,
  ) {}

  @Mutation(() => Identifier)
  @MemberIdParam(MemberIdParamType.memberId)
  @UseInterceptors(MemberUserRouteInterceptor)
  @Roles(UserRole.coach, UserRole.nurse, MemberRole.member)
  async createTodo(
    @Client('roles') roles,
    @Client('_id') clientId,
    @Args(camelCase(CreateTodoParams.name)) createTodoParams: CreateTodoParams,
  ) {
    const status = this.getTodoStatus(createTodoParams, roles);
    const todo = await this.todoService.createTodo({
      ...createTodoParams,
      status,
    });
    this.todoSendNotification(todo, roles, clientId, 'createTodo');
    return { id: todo.id };
  }

  @Mutation(() => Identifier)
  @Roles(UserRole.coach, UserRole.nurse)
  async createActionTodo(
    @Args(camelCase(CreateActionTodoParams.name)) createActionTodoParams: CreateActionTodoParams,
  ) {
    return this.todoService.createActionTodo(createActionTodoParams);
  }

  @Query(() => [Todo])
  @MemberIdParam(MemberIdParamType.memberId)
  @UseInterceptors(MemberUserRouteInterceptor)
  @Roles(UserRole.coach, UserRole.nurse, MemberRole.member)
  async getTodos(
    @Args(
      'memberId',
      { type: () => String, nullable: true },
      new IsValidObjectId(Errors.get(ErrorType.memberIdInvalid), { nullable: true }),
    )
    memberId?: string,
  ) {
    return this.todoService.getTodos(memberId);
  }

  @Mutation(() => Todo)
  @MemberIdParam(MemberIdParamType.memberId)
  @UseInterceptors(MemberUserRouteInterceptor)
  @Roles(UserRole.coach, UserRole.nurse, MemberRole.member)
  async updateTodo(
    @Client('roles') roles,
    @Client('_id') clientId,
    @Args(camelCase(UpdateTodoParams.name)) updateTodoParams: UpdateTodoParams,
  ) {
    const status = this.getTodoStatus(updateTodoParams, roles);
    const todo = await this.todoService.updateTodo({
      ...updateTodoParams,
      status,
    });
    this.todoSendNotification(todo, roles, clientId, 'updateTodo');
    return todo;
  }

  @Mutation(() => Boolean)
  @Roles(UserRole.coach, UserRole.nurse, MemberRole.member)
  async endTodo(
    @Client('_id') clientId,
    @Client('roles') roles,
    @Args('id', { type: () => String }, new IsValidObjectId(Errors.get(ErrorType.todoIdInvalid)))
    id: string,
  ) {
    if (roles.includes(MemberRole.member)) {
      const todo = await this.todoService.getTodo(id, clientId);
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
    return this.todoService.approveTodo(id, memberId);
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
    return this.todoService.createTodoDone(createTodoDoneParams);
  }

  @Query(() => [TodoDone])
  @MemberIdParam(MemberIdParamType.memberId)
  @UseInterceptors(MemberUserRouteInterceptor)
  @Roles(UserRole.coach, UserRole.nurse, MemberRole.member)
  async getTodoDones(
    @Args(camelCase(GetTodoDonesParams.name)) getTodoDonesParams: GetTodoDonesParams,
  ) {
    return this.todoService.getTodoDones(getTodoDonesParams);
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
    return this.todoService.deleteTodoDone(id, memberId);
  }

  /*************************************************************************************************
   ******************************************** Helpers ********************************************
   ************************************************************************************************/

  private getTodoStatus(params: ExtraTodoParams, roles: RoleTypes): TodoStatus {
    return (roles.includes(UserRole.coach) ||
      roles.includes(UserRole.nurse) ||
      roles.includes(UserRole.admin)) &&
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
      roles.includes(UserRole.coach) ||
      roles.includes(UserRole.nurse) ||
      roles.includes(UserRole.admin)
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
