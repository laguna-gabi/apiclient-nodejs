import { Field, InputType, ObjectType, registerEnumType } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ISoftDelete, audit, useFactoryOptions } from '../db';
import * as mongooseDelete from 'mongoose-delete';
import { IsDate, IsOptional } from 'class-validator';
import { ErrorType, Errors } from '../common';
import { Identifier } from '@argus/hepiusClient';
import { DefaultSchemaOptions } from '@argus/pandora';

/**************************************************************************************************
 ******************************* Enum registration for gql methods ********************************
 *************************************************************************************************/
export enum ActionItemStatus {
  active = 'active',
  completed = 'completed',
  refused = 'refused',
}

registerEnumType(ActionItemStatus, { name: 'ActionItemStatus' });

export enum ActionItemCategory {
  learn = 'learn',
  legWork = 'legWork',
  nextSession = 'nextSession',
}

registerEnumType(ActionItemCategory, { name: 'ActionItemCategory' });

export enum ActionItemPriority {
  urgent = 'urgent',
  normal = 'normal',
}

registerEnumType(ActionItemPriority, { name: 'ActionItemPriority' });

export enum RelatedEntityType {
  questionnaire = 'questionnaire',
}

registerEnumType(RelatedEntityType, { name: 'RelatedEntityType' });

export const nullableActionItemKeys = ['deadline', 'description', 'rejectNote', 'category'];

/**************************************************************************************************
 ********************************** Input params for gql methods **********************************
 *************************************************************************************************/

/**
 * Performs create or set for action items (set if there's an Id, create otherwise)
 * In the case of action items we are requires to allow removing attributes on update.
 * That's the reason we're using set instead of update (similar to PUT vs PATCH)
 * Calling CreateOrSetActionItem requires ALL attributes from the original dto,
 * because we will replace the old object the new one.
 */
@InputType({ isAbstract: true })
export class CreateOrSetActionItemParams {
  @Field(() => String, { nullable: true })
  id?: string;

  @Field(() => String, { nullable: true })
  memberId?: string;

  @Field(() => String)
  title: string;

  @Field(() => ActionItemStatus, { nullable: true })
  status?: ActionItemStatus;

  @Field(() => Date, { nullable: true })
  @IsDate({ message: Errors.get(ErrorType.journeyActionItemDeadline) })
  @IsOptional()
  deadline?: Date;

  @Field(() => [RelatedEntity], { nullable: true })
  relatedEntities?: RelatedEntity[];

  @Field(() => String, { nullable: true })
  description?: string;

  @Field(() => ActionItemCategory, { nullable: true })
  category?: ActionItemCategory;

  @Field(() => ActionItemPriority, { nullable: true })
  priority?: ActionItemPriority;

  @Field(() => String, { nullable: true })
  rejectNote?: string;
}

/**************************************************************************************************
 ********************************* Return params for gql methods **********************************
 *************************************************************************************************/
@InputType('RelatedEntityInput')
@ObjectType()
export class RelatedEntity {
  @Prop({ type: String, enum: RelatedEntityType })
  @Field(() => RelatedEntityType)
  type: RelatedEntityType;

  @Prop()
  @Field(() => String, { nullable: true })
  id?: string;
}

@ObjectType()
@Schema(DefaultSchemaOptions)
export class ActionItem extends Identifier {
  @Prop({ index: true, type: Types.ObjectId })
  @Field(() => String)
  memberId: Types.ObjectId;

  @Prop({ index: true, type: Types.ObjectId })
  @Field(() => String)
  journeyId: Types.ObjectId;

  @Prop()
  @Field(() => String)
  title: string;

  @Prop({ type: String, enum: ActionItemStatus })
  @Field(() => ActionItemStatus)
  status: ActionItemStatus;

  @Prop()
  @Field(() => [RelatedEntity])
  relatedEntities: RelatedEntity[];

  @Prop({ type: Date })
  @Field(() => Date, { nullable: true })
  deadline?: Date;

  @Prop()
  @Field(() => String, { nullable: true })
  description?: string;

  @Prop()
  @Field(() => String, { nullable: true })
  rejectNote?: string;

  @Prop({ type: String, enum: ActionItemCategory })
  @Field(() => ActionItemCategory, { nullable: true })
  category?: ActionItemCategory;

  @Prop({ type: String, enum: ActionItemPriority })
  @Field(() => ActionItemPriority)
  priority: ActionItemPriority;

  @Field(() => Date)
  createdAt: Date;

  @Field(() => String)
  createdBy: Types.ObjectId;

  @Field(() => String)
  updatedBy: Types.ObjectId;
}

/**************************************************************************************************
 **************************************** Exported Schemas ****************************************
 *************************************************************************************************/
export type ActionItemDocument = ActionItem & Document & ISoftDelete<ActionItem>;
export const ActionItemDto = audit(
  SchemaFactory.createForClass(ActionItem).plugin(mongooseDelete, useFactoryOptions),
);
