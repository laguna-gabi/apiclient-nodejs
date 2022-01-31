import { UseInterceptors } from '@nestjs/common';
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
  TodoService,
  TodoStatus,
} from '.';
import {
  Client,
  ErrorType,
  Errors,
  Identifier,
  LoggingInterceptor,
  MemberIdParam,
  MemberIdParamType,
  MemberRole,
  MemberUserRouteInterceptor,
  RoleTypes,
  Roles,
  UserRole,
} from '../common';

@UseInterceptors(LoggingInterceptor)
@Resolver(() => Todo)
export class TodoResolver {
  constructor(private readonly todoService: TodoService) {}

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
    return this.todoService.createTodo({
      ...createTodoParams,
      status,
      createdBy: clientId,
      updatedBy: clientId,
    });
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
    return this.todoService.endAndCreateTodo({
      ...endAndCreateTodoParams,
      status,
      updatedBy: clientId,
    });
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
    return this.todoService.endTodo(id, clientId);
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
    return (roles.includes(UserRole.coach) || roles.includes(UserRole.nurse)) &&
      params.label === Label.MEDS
      ? TodoStatus.requested
      : TodoStatus.active;
  }
}
