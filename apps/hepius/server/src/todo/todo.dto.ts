import { Field, InputType, ObjectType, registerEnumType } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ArrayNotEmpty, IsNotEmpty, IsOptional } from 'class-validator';
import { Document, Types } from 'mongoose';
import {
  ErrorType,
  Errors,
  IsCronExpression,
  IsDateAfter,
  IsFutureDate,
  IsObjectId,
  isTodoDateParamsValidCreate,
  isTodoDateParamsValidUpdate,
} from '../common';
import { ISoftDelete, audit, useFactoryOptions } from '../db';
import * as mongooseDelete from 'mongoose-delete';
import { Identifier } from '@argus/hepiusClient';

export const NotNullableTodoKeys = ['label', 'cronExpressions', 'start', 'end'];

export type TodoNotificationsType = 'createTodo' | 'createActionTodo' | 'updateTodo' | 'deleteTodo';

/**************************************************************************************************
 ******************************* Enum registration for gql methods ********************************
 *************************************************************************************************/

export enum TodoStatus {
  active = 'active',
  updated = 'updated',
  ended = 'ended',
  requested = 'requested',
}

registerEnumType(TodoStatus, { name: 'TodoStatus' });

export enum TodoLabel {
  Meds = 'Meds',
  Appointment = 'Appointment',
}

registerEnumType(TodoLabel, { name: 'Label' });

export enum ActionTodoLabel {
  Questionnaire = 'Questionnaire',
  Explore = 'Explore',
  Scanner = 'Scanner',
  Journal = 'Journal',
}

registerEnumType(ActionTodoLabel, { name: 'ActionTodoLabel' });

export type Label = TodoLabel | ActionTodoLabel;

export enum ResourceType {
  article = 'article',
  video = 'video',
  audio = 'audio',
}

registerEnumType(ResourceType, { name: 'ResourceType' });

@InputType('ResourceInput')
@ObjectType()
export class Resource {
  @Prop()
  @Field(() => String)
  id: string;

  @Prop()
  @Field(() => String, { nullable: true })
  name?: string;

  @Prop({ type: String, enum: ResourceType })
  @Field(() => ResourceType, { nullable: true })
  type?: ResourceType;
}

/**************************************************************************************************
 ********************************** Input params for gql methods **********************************
 *************************************************************************************************/

@InputType()
export class ExtraTodoParams {
  @Field(() => String, { nullable: true })
  @IsObjectId({ message: Errors.get(ErrorType.memberIdInvalid) })
  memberId?: string;

  @Field(() => String)
  @IsNotEmpty()
  text: string;

  @Field(() => TodoLabel, { nullable: true })
  label?: TodoLabel;

  @Field(() => [String], { nullable: true })
  @IsCronExpression({ message: Errors.get(ErrorType.todoInvalidCronExpression) })
  @IsOptional()
  @ArrayNotEmpty()
  cronExpressions?: string[];

  @Field(() => Date, { nullable: true })
  @IsDateAfter('start', {
    message: Errors.get(ErrorType.todoEndAfterStart),
  })
  @IsFutureDate({
    message: Errors.get(ErrorType.todoEndDateInThePast),
  })
  end?: Date;

  status?: TodoStatus;
}

@InputType()
export class CreateTodoParams extends ExtraTodoParams {
  @Field(() => Date, { nullable: true })
  @isTodoDateParamsValidCreate({ message: Errors.get(ErrorType.todoUnscheduled) })
  start?: Date;
}

@InputType()
export class CreateActionTodoParams {
  @Field(() => String)
  @IsObjectId({ message: Errors.get(ErrorType.memberIdInvalid) })
  memberId: string;

  @Field(() => ActionTodoLabel)
  label: ActionTodoLabel;

  @Field(() => Resource, { nullable: true })
  resource?: Resource;
}

@InputType()
export class UpdateTodoParams extends ExtraTodoParams {
  @Field(() => Date, { nullable: true })
  @isTodoDateParamsValidUpdate({ message: Errors.get(ErrorType.todoUnscheduledUpdate) })
  @IsFutureDate({
    message: Errors.get(ErrorType.todoStartDateInThePast),
  })
  start?: Date;

  @Field(() => String)
  @IsObjectId({ message: Errors.get(ErrorType.todoIdInvalid) })
  id: string;
}

@InputType()
export class CreateTodoDoneParams {
  @Field(() => String)
  @IsObjectId({ message: Errors.get(ErrorType.todoIdInvalid) })
  todoId: string;

  @Field(() => Date)
  done: Date;

  memberId: string;
}

@InputType()
export class GetTodoDonesParams {
  @Field(() => String, { nullable: true })
  @IsObjectId({ message: Errors.get(ErrorType.memberIdInvalid) })
  memberId?: string;

  @Field(() => Date)
  start: Date;

  @Field(() => Date)
  @IsDateAfter('start', {
    message: Errors.get(ErrorType.todoEndAfterStart),
  })
  end: Date;
}

/********∏******************************************************************************************
 ********************************* Return params for gql methods **********************************
 *************************************************************************************************/

@ObjectType()
@Schema({ versionKey: false, timestamps: true })
export class Todo extends Identifier {
  @Prop({ index: true, type: Types.ObjectId })
  @Field(() => String)
  memberId: Types.ObjectId;

  @Prop()
  @Field(() => String, { nullable: true })
  text?: string;

  @Prop()
  @Field({ nullable: true })
  label?: Label;

  @Prop({ default: undefined })
  @Field(() => [String], { nullable: true })
  cronExpressions?: string[];

  @Prop({ type: Date })
  @Field(() => Date, { nullable: true })
  start?: Date;

  @Prop({ type: Date })
  @Field(() => Date, { nullable: true })
  end?: Date;

  @Prop({ type: String, enum: TodoStatus, default: TodoStatus.active })
  @Field(() => TodoStatus)
  status: TodoStatus;

  @Prop()
  @Field(() => Resource, { nullable: true })
  resource?: Resource;

  @Prop({ type: Types.ObjectId })
  @Field(() => String, { nullable: true })
  relatedTo?: Types.ObjectId;

  @Prop({ type: Types.ObjectId })
  @Field(() => String)
  createdBy: Types.ObjectId;

  @Prop({ type: Types.ObjectId })
  @Field(() => String)
  updatedBy: Types.ObjectId;
}

@ObjectType()
@Schema({ versionKey: false, timestamps: true })
export class TodoDone extends Identifier {
  @Prop({ index: true, type: Types.ObjectId })
  @Field(() => String)
  memberId: Types.ObjectId;

  @Prop({ index: true, type: Types.ObjectId })
  @Field(() => String)
  todoId: Types.ObjectId;

  @Prop({ type: Date })
  @Field(() => Date)
  done: Date;
}

/**************************************************************************************************
 **************************************** Exported Schemas ****************************************
 *************************************************************************************************/
export type TodoDocument = Todo & Document & ISoftDelete<Todo>;
export const TodoDto = audit(
  SchemaFactory.createForClass(Todo).plugin(mongooseDelete, useFactoryOptions),
);

export type TodoDoneDocument = TodoDone & Document & ISoftDelete<TodoDone>;
export const TodoDoneDto = audit(
  SchemaFactory.createForClass(TodoDone).plugin(mongooseDelete, useFactoryOptions),
);
