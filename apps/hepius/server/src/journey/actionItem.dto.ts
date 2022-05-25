import { Field, InputType, ObjectType, registerEnumType } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ISoftDelete, audit, useFactoryOptions } from '../db';
import * as mongooseDelete from 'mongoose-delete';
import { IsDate } from 'class-validator';
import { ErrorType, Errors } from '../common';
import { Identifier } from '@argus/hepiusClient';

/**************************************************************************************************
 ******************************* Enum registration for gql methods ********************************
 *************************************************************************************************/
export enum ActionItemStatus {
  pending = 'pending',
  reached = 'reached',
}

registerEnumType(ActionItemStatus, { name: 'ActionItemStatus' });

/**************************************************************************************************
 ********************************** Input params for gql methods **********************************
 *************************************************************************************************/
@InputType({ isAbstract: true })
export class CreateActionItemParams {
  @Field(() => String)
  memberId: string;

  @Field(() => String)
  title: string;

  @Field(() => Date)
  @IsDate({ message: Errors.get(ErrorType.journeyActionItemDeadline) })
  deadline: Date;
}

@InputType({ isAbstract: true })
export class UpdateActionItemStatusParams {
  @Field(() => String)
  id: string;

  @Field(() => ActionItemStatus)
  status: ActionItemStatus;
}

/**************************************************************************************************
 ********************************* Return params for gql methods **********************************
 *************************************************************************************************/
@ObjectType()
@Schema({ versionKey: false, timestamps: true })
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

  @Prop({ type: Date })
  @Field(() => Date)
  deadline: Date;
}

/**************************************************************************************************
 **************************************** Exported Schemas ****************************************
 *************************************************************************************************/
export type ActionItemDocument = ActionItem & Document & ISoftDelete<ActionItem>;
export const ActionItemDto = audit(
  SchemaFactory.createForClass(ActionItem).plugin(mongooseDelete, useFactoryOptions),
);
