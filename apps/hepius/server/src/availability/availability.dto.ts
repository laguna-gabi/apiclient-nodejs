import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import * as mongooseDelete from 'mongoose-delete';
import { Identifier } from '@argus/hepiusClient';
import { ISoftDelete, audit, useFactoryOptions } from '../db';
import { DefaultSchemaOptions } from '@argus/pandora';

/**************************************************************************************************
 ********************************** Input params for gql methods **********************************
 *************************************************************************************************/
@InputType()
export class AvailabilityInput {
  @Field(() => Date)
  start: Date;

  @Field(() => Date)
  end: Date;
}

/**************************************************************************************************
 ********************************* Return params for gql methods **********************************
 *************************************************************************************************/
@ObjectType()
@Schema(DefaultSchemaOptions)
export class Availability extends Identifier {
  @Prop({ type: Date })
  @Field(() => Date)
  start: Date;

  @Prop({ type: Date })
  @Field(() => Date)
  end: Date;

  @Prop({ index: true, type: Types.ObjectId })
  @Field(() => String)
  userId: Types.ObjectId;
}

@ObjectType()
export class AvailabilitySlot extends Identifier {
  @Field(() => Date)
  start: Date;

  @Field(() => Date)
  end: Date;

  @Field(() => String)
  userId: string;

  @Field(() => String)
  userName: string;
}

/**************************************************************************************************
 **************************************** Exported Schemas ****************************************
 *************************************************************************************************/
export type AvailabilityDocument = Availability & Document & ISoftDelete<Availability>;
export const AvailabilityDto = audit(
  SchemaFactory.createForClass(Availability).plugin(mongooseDelete, useFactoryOptions),
);
