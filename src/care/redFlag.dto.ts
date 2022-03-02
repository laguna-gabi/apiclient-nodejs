import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ErrorType, Errors, Identifier, IsObjectId } from '../common';
import { RedFlagType } from '.';
import { ISoftDelete, audit, useFactoryOptions } from '../db';
import * as mongooseDelete from 'mongoose-delete';

/**************************************************************************************************
 ********************************** Input params for gql methods **********************************
 *************************************************************************************************/

@InputType()
export class BaseRedFlagParams {
  @Field(() => RedFlagType)
  type: RedFlagType;

  @Field(() => String, { nullable: true })
  notes?: string;
}

@InputType()
export class CreateRedFlagParams extends BaseRedFlagParams {
  @Field(() => String)
  @IsObjectId({ message: Errors.get(ErrorType.memberIdInvalid) })
  memberId: string;
}

@InputType()
export class UpdateRedFlagParams {
  @Field(() => String)
  @IsObjectId({ message: Errors.get(ErrorType.redFlagNotFound) })
  id: string;

  @Field(() => String, { nullable: true })
  notes?: string;
}

/**************************************************************************************************
 ********************************* Return params for gql methods **********************************
 *************************************************************************************************/

@ObjectType()
@Schema({ versionKey: false, timestamps: true })
export class RedFlag extends Identifier {
  @Prop({ index: true, type: Types.ObjectId })
  @Field(() => String)
  memberId: Types.ObjectId;

  @Prop({ type: Types.ObjectId })
  @Field(() => String)
  createdBy: Types.ObjectId;

  @Prop({ index: true, type: String, enum: RedFlagType })
  @Field(() => RedFlagType)
  type: RedFlagType;

  @Field(() => Date)
  createdAt: Date;

  @Field(() => Date)
  updatedAt: Date;

  @Prop()
  @Field(() => String, { nullable: true })
  notes?: string;
}

/**************************************************************************************************
 **************************************** Exported Schemas ****************************************
 *************************************************************************************************/
export type RedFlagDocument = RedFlag & Document & ISoftDelete<RedFlag>;
export const RedFlagDto = audit(
  SchemaFactory.createForClass(RedFlag).plugin(mongooseDelete, useFactoryOptions),
);
