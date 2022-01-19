import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ErrorType, Errors, Identifier, IsObjectId } from '../common';
import { RedFlagType } from '.';

/**************************************************************************************************
 ********************************** Input params for gql methods **********************************
 *************************************************************************************************/

@InputType()
export class CreateRedFlagParams {
  @Field(() => String)
  @IsObjectId({ message: Errors.get(ErrorType.memberIdInvalid) })
  memberId: string;

  @Field(() => RedFlagType)
  redFlagType: RedFlagType;

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

  @Prop({ index: true, type: RedFlagType })
  @Field(() => RedFlagType)
  redFlagType: RedFlagType;

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
export type RedFlagDocument = RedFlag & Document;
export const RedFlagDto = SchemaFactory.createForClass(RedFlag);
