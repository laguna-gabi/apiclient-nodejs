import { Field, InputType, ObjectType, registerEnumType } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ArrayNotEmpty, IsOptional } from 'class-validator';
import { Document, Types } from 'mongoose';
import {
  ErrorType,
  Errors,
  Identifier,
  IsCronExpression,
  IsDateAfter,
  IsObjectId,
  IsUnscheduledTodo,
} from '../common';

export const NotNullableTodoKeys = ['label', 'end'];

export type TodoNotificationsType = 'createTodo' | 'updateTodo' | 'deleteTodo';

/**************************************************************************************************
 ******************************* Enum registration for gql methods ********************************
 *************************************************************************************************/

export enum TodoStatus {
  active = 'active',
  ended = 'ended',
  requested = 'requested',
}

registerEnumType(TodoStatus, { name: 'TodoStatus' });

export enum Label {
  MEDS = 'MEDS',
  APPT = 'APPT',
}

registerEnumType(Label, { name: 'Label' });

/**************************************************************************************************
 ********************************** Input params for gql methods **********************************
 *************************************************************************************************/

@InputType()
export class ExtraTodoParams {
  @Field(() => String, { nullable: true })
  @IsObjectId({ message: Errors.get(ErrorType.memberIdInvalid) })
  memberId?: string;

  @Field(() => String)
  text: string;

  @Field(() => Label, { nullable: true })
  label?: Label;

  @Field(() => [String], { nullable: true })
  @IsCronExpression({ message: Errors.get(ErrorType.todoInvalidCronExpression) })
  @IsOptional()
  @ArrayNotEmpty()
  cronExpressions?: string[];

  @Field(() => Date, { nullable: true })
  @IsUnscheduledTodo({ message: Errors.get(ErrorType.todoUnscheduled) })
  start?: Date;

  @Field(() => Date, { nullable: true })
  @IsDateAfter('start', {
    message: Errors.get(ErrorType.todoEndAfterStart),
  })
  end?: Date;

  status?: TodoStatus;

  updatedBy: string;
}

@InputType()
export class CreateTodoParams extends ExtraTodoParams {
  createdBy: string;
}

@InputType()
export class EndAndCreateTodoParams extends ExtraTodoParams {
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
  @Field(() => String)
  text: string;

  @Prop()
  @Field(() => Label, { nullable: true })
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

  @Prop({ default: TodoStatus.active })
  @Field(() => TodoStatus)
  status: TodoStatus;

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
export type TodoDocument = Todo & Document;
export const TodoDto = SchemaFactory.createForClass(Todo);

export type TodoDoneDocument = TodoDone & Document;
export const TodoDoneDto = SchemaFactory.createForClass(TodoDone);
