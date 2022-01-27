import { UseInterceptors } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { camelCase } from 'lodash';
import {
  CreateTodoDoneParams,
  CreateTodoParams,
  EndAndCreateTodoParams,
  GetTodoDonesParams,
  Todo,
  TodoDone,
  TodoService,
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
    @Client('_id') clientId,
    @Args(camelCase(CreateTodoParams.name)) createTodoParams: CreateTodoParams,
  ) {
    return this.todoService.createTodo({
      ...createTodoParams,
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
    @Client('_id') clientId,
    @Args(camelCase(EndAndCreateTodoParams.name)) endAndCreateTodoParams: EndAndCreateTodoParams,
  ) {
    return this.todoService.endAndCreateTodo({ ...endAndCreateTodoParams, updatedBy: clientId });
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
    const { todoId, memberId } = createTodoDoneParams;
    const todo = await this.todoService.getTodo(todoId, memberId);
    if (!todo.cronExpressions && !todo.start && !todo.end) {
      await this.todoService.endTodo(todoId, memberId);
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
}
