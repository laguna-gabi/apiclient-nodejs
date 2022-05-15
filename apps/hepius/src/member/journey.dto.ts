import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ISoftDelete, audit, useFactoryOptions } from '../db';
import * as mongooseDelete from 'mongoose-delete';
import { Identifier } from '@argus/hepiusClient';
import { IsOptional } from 'class-validator';

/**************************************************************************************************
 ********************************** Input params for gql methods **********************************
 *************************************************************************************************/
@InputType()
export class CreateJourneyParams {
  @Field(() => String)
  memberId: string;
}

@InputType()
export class UpdateJourneyParams extends CreateJourneyParams {
  // if id is not supplied, we're updating the default journey of the member
  @Field(() => String, { nullable: true })
  @IsOptional()
  id?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  fellowName?: string;
}
/***************************************************************************************************
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
  active: boolean;

  @Prop({ type: [{ type: Types.ObjectId }], default: [] })
  @Field(() => [String])
  admissions: Types.ObjectId[];

  @Prop({ type: Date })
  @Field(() => Date, { nullable: true })
  firstLoggedInAt?: Date;

  @Prop({ type: Date })
  @Field(() => Date, { nullable: true })
  lastLoggedInAt?: Date;

  @Prop({ isNaN: true })
  @Field(() => String, { nullable: true })
  fellowName?: string;
}

/**************************************************************************************************
 **************************************** Exported Schemas ****************************************
 *************************************************************************************************/
export type JourneyDocument = Journey & Document & ISoftDelete<Journey>;
export const JourneyDto = audit(
  SchemaFactory.createForClass(Journey).plugin(mongooseDelete, useFactoryOptions),
);
