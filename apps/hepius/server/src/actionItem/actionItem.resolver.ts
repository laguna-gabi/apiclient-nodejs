import { UserRole } from '@argus/hepiusClient';
import { EntityName } from '@argus/pandora';
import { UseInterceptors } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { camelCase } from 'lodash';
import { ActionItem, ActionItemService, CreateOrSetActionItemParams } from '.';
import {
  Ace,
  Client,
  ErrorType,
  Errors,
  IsValidObjectId,
  LoggingInterceptor,
  Roles,
} from '../common';

@UseInterceptors(LoggingInterceptor)
@Resolver(() => ActionItem)
export class ActionItemResolver {
  constructor(private readonly actionItemService: ActionItemService) {}

  @Mutation(() => ActionItem)
  @Roles(UserRole.lagunaCoach, UserRole.lagunaNurse)
  async createOrSetActionItem(
    @Args(camelCase(CreateOrSetActionItemParams.name))
    createOrSetActionItemParams: CreateOrSetActionItemParams,
  ) {
    return this.actionItemService.createOrSetActionItem(createOrSetActionItemParams);
  }

  @Query(() => [ActionItem])
  @Roles(UserRole.lagunaCoach, UserRole.lagunaNurse, UserRole.coach)
  @Ace({ entityName: EntityName.member, idLocator: 'memberId' })
  async getActionItems(
    @Args(
      'memberId',
      { type: () => String, nullable: false },
      new IsValidObjectId(Errors.get(ErrorType.memberIdInvalid), { nullable: true }),
    )
    memberId: string,
  ) {
    return this.actionItemService.getActionItems(memberId);
  }

  @Mutation(() => Boolean)
  @Roles(UserRole.lagunaCoach, UserRole.lagunaNurse, UserRole.coach)
  @Ace({ entityName: EntityName.actionitem, idLocator: `id`, entityMemberIdLocator: 'memberId' })
  async deleteActionItem(
    @Client('_id') userId,
    @Args(
      'id',
      { type: () => String },
      new IsValidObjectId(Errors.get(ErrorType.actionItemIdInvalid)),
    )
    id: string,
  ) {
    return this.actionItemService.delete(id, userId);
  }
}
