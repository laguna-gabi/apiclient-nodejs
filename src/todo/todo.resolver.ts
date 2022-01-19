import { UseInterceptors } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { camelCase } from 'lodash';
import { CreateTodoParams, DeleteTodoParams, EndAndCreateTodoParams, Todo, TodoService } from '.';
import {
  Client,
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
  @MemberIdParam(MemberIdParamType.memberId)
  @UseInterceptors(MemberUserRouteInterceptor)
  @Roles(UserRole.coach, UserRole.nurse, MemberRole.member)
  async deleteTodo(
    @Client('_id') clientId,
    @Args(camelCase(DeleteTodoParams.name)) deleteTodoParams: DeleteTodoParams,
  ) {
    return this.todoService.deleteTodo({ ...deleteTodoParams, deletedBy: clientId });
  }
}
