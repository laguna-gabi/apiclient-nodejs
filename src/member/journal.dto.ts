import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Identifier } from '../common';

/**************************************************************************************************
 ********************************** Input params for gql methods **********************************
 *************************************************************************************************/

@InputType()
export class UpdateJournalParams {
  @Field(() => String)
  id: string;

  @Field(() => String)
  text: string;
}

/********∏******************************************************************************************
 ********************************* Return params for gql methods **********************************
 *************************************************************************************************/

@ObjectType()
@Schema({ versionKey: false, timestamps: true })
export class Journal extends Identifier {
  @Prop({ index: true, type: Types.ObjectId })
  @Field(() => String)
  memberId: Types.ObjectId;

  @Prop()
  @Field(() => String, { nullable: true })
  text?: string;

  @Prop({ default: false })
  @Field(() => Boolean)
  published: boolean;

  @Field(() => Date)
  updatedAt: Date;
}

/**************************************************************************************************
 **************************************** Exported Schemas ****************************************
 *************************************************************************************************/
export type JournalDocument = Journal & Document;
export const JournalDto = SchemaFactory.createForClass(Journal);
