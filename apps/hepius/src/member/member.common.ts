import { Field, InputType, ObjectType, registerEnumType } from '@nestjs/graphql';
import { Prop, Schema } from '@nestjs/mongoose';
import { IsDate } from 'class-validator';
import { ErrorType, Errors } from '../common';
import { Identifier } from '@argus/hepiusClient';

/**************************************************************************************************
 ******************************* Enum registration for gql methods ********************************
 *************************************************************************************************/
export enum TaskStatus {
  pending = 'pending',
  reached = 'reached',
}

export enum ChatMessageOrigin {
  fromUser = 'fromUser',
  fromMember = 'fromMember',
}

registerEnumType(TaskStatus, { name: 'TaskStatus' });

/**************************************************************************************************
 ********************************** Input params for gql methods **********************************
 *************************************************************************************************/
@InputType({ isAbstract: true })
export class CreateTaskParams {
  @Field(() => String)
  memberId: string;

  @Field(() => String)
  title: string;

  @Field(() => Date)
  @IsDate({ message: Errors.get(ErrorType.memberTaskDeadline) })
  deadline: Date;
}

@InputType({ isAbstract: true })
export class UpdateTaskStatusParams {
  @Field(() => String)
  id: string;

  @Field(() => TaskStatus)
  status: TaskStatus;
}

/**************************************************************************************************
 ********************************* Return params for gql methods **********************************
 *************************************************************************************************/
@ObjectType({ isAbstract: true })
@Schema({ versionKey: false, timestamps: true })
export class Task extends Identifier {
  @Prop()
  @Field(() => String)
  title: string;

  @Prop({ type: String, enum: TaskStatus })
  @Field(() => TaskStatus)
  status: TaskStatus;

  @Prop({ type: Date })
  @Field(() => Date)
  deadline: Date;
}
