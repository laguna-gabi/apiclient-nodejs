import { Prop, Schema } from '@nestjs/mongoose';
import { Field, InputType, ObjectType, registerEnumType } from '@nestjs/graphql';
import { Errors, ErrorType, Identifier } from '../common';
import { IsDate } from 'class-validator';

/**************************************************************************************************
 ******************************* Enum registration for gql methods ********************************
 *************************************************************************************************/
export enum TaskStatus {
  pending = 'pending',
  reached = 'reached',
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

  @Prop({ type: TaskStatus })
  @Field(() => TaskStatus)
  status: TaskStatus;

  @Prop({ type: Date })
  @Field(() => Date)
  deadline: Date;
}

@InputType()
export class ContentMetadata {
  @Field(() => String)
  content: string;
}
