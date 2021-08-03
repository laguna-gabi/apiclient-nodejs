import { Document } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Identifier } from '../common';

/**************************************************************************************************
 ********************************** Input params for gql methods **********************************
 *************************************************************************************************/
@InputType()
export class AvailabilityInput {
  @Field(() => Date)
  start: Date;

  @Field(() => Date)
  end: Date;

  @Field(() => String)
  userId: string;
}

/**************************************************************************************************
 ********************************* Return params for gql methods **********************************
 *************************************************************************************************/
@ObjectType()
@Schema({ versionKey: false, timestamps: true })
export class Availability extends Identifier {
  @Prop({ type: Date })
  @Field(() => Date)
  start: Date;

  @Prop({ type: Date })
  @Field(() => Date)
  end: Date;

  @Prop({ index: true })
  @Field(() => String)
  userId: string;
}

/**************************************************************************************************
 **************************************** Exported Schemas ****************************************
 *************************************************************************************************/
export type AvailabilityDocument = Availability & Document;
export const AvailabilityDto = SchemaFactory.createForClass(Availability);
