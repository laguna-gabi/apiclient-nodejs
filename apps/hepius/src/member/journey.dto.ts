import { Field, ObjectType } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ISoftDelete, audit, useFactoryOptions } from '../db';
import * as mongooseDelete from 'mongoose-delete';
import { Identifier } from '@argus/hepiusClient';

/********∏******************************************************************************************
 ********************************* Return params for gql methods **********************************
 *************************************************************************************************/

@ObjectType()
@Schema({ versionKey: false, timestamps: true })
export class Journey extends Identifier {
  @Prop({ type: Types.ObjectId, index: true })
  @Field(() => String)
  memberId: Types.ObjectId;

  @Prop({ type: Boolean, index: true, default: true })
  @Field(() => Boolean)
  isActive: boolean;

  @Prop({ type: [{ type: Types.ObjectId }], default: [] })
  @Field(() => [String])
  admissions: Types.ObjectId[];
}

/**************************************************************************************************
 **************************************** Exported Schemas ****************************************
 *************************************************************************************************/
export type JourneyDocument = Journey & Document & ISoftDelete<Journey>;
export const JourneyDto = audit(
  SchemaFactory.createForClass(Journey).plugin(mongooseDelete, useFactoryOptions),
);
