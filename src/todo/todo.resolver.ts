import { NotificationType, TodoInternalKey, generateDispatchId } from '@lagunahealth/pandora';
import { UseInterceptors } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { camelCase } from 'lodash';
import {
  CreateTodoDoneParams,
  CreateTodoParams,
  EndAndCreateTodoParams,
  ExtraTodoParams,
  GetTodoDonesParams,
  Label,
  Todo,
  TodoDone,
  TodoNotificationsType,
  TodoService,
  TodoStatus,
} from '.';
import {
  Client,
  ErrorType,
  Errors,
  EventType,
  IInternalDispatch,
  Identifier,
  LoggerService,
  LoggingInterceptor,
  MemberIdParam,
  MemberIdParamType,
  MemberRole,
  MemberUserRouteInterceptor,
  RoleTypes,
  Roles,
  UserRole,
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

  @Query(() => [Todo])
  @MemberIdParam(MemberIdParamType.memberId)
  @UseInterceptors(MemberUserRouteInterceptor)
  @Roles(UserRole.coach, UserRole.nurse, MemberRole.member)
  async getTodos(@Args('memberId', { type: () => String, nullable: true }) memberId?: string) {
    return this.todoService.getTodos(memberId);
  }

  @Mutation(() => Todo)
  @MemberIdParam(MemberIdParamType.memberId)
  @UseInterceptors(MemberUserRouteInterceptor)
  @Roles(UserRole.coach, UserRole.nurse, MemberRole.member)
  async endAndCreateTodo(
    @Client('roles') roles,
    @Client('_id') clientId,
    @Args(camelCase(EndAndCreateTodoParams.name)) endAndCreateTodoParams: EndAndCreateTodoParams,
  ) {
    const status = this.getTodoStatus(endAndCreateTodoParams, roles);
    const todo = await this.todoService.endAndCreateTodo({
      ...endAndCreateTodoParams,
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
    @Args('id', { type: () => String }) id: string,
  ) {
    if (roles.includes(MemberRole.member)) {
      await this.todoService.getTodo(id, clientId);
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
    @Args('id', { type: () => String }) id: string,
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
    @Args('id', { type: () => String }) id: string,
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
      params.label === Label.MEDS
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
      };
      this.eventEmitter.emit(EventType.notifyDispatch, createTodoEvent);
    }
  }

  extractContentType(todoNotificationsType: TodoNotificationsType, label?: Label): TodoInternalKey {
    if (todoNotificationsType === 'createTodo') {
      switch (label) {
        case Label.APPT:
          return TodoInternalKey.createTodoAPPT;
        case Label.MEDS:
          return TodoInternalKey.createTodoMEDS;
        default:
          return TodoInternalKey.createTodoTODO;
      }
    } else if (todoNotificationsType === 'updateTodo') {
      switch (label) {
        case Label.APPT:
          return TodoInternalKey.updateTodoAPPT;
        case Label.MEDS:
          return TodoInternalKey.updateTodoMEDS;
        default:
          return TodoInternalKey.updateTodoTODO;
      }
    } else if (todoNotificationsType === 'deleteTodo') {
      switch (label) {
        case Label.APPT:
          return TodoInternalKey.deleteTodoAPPT;
        case Label.MEDS:
          return TodoInternalKey.deleteTodoMEDS;
        default:
          return TodoInternalKey.deleteTodoTODO;
      }
    }
  }
}
