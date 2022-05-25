import { Field, InputType } from '@nestjs/graphql';
import { Prop, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { ErrorType, Errors } from '../common';
import { IsDate, IsOptional } from 'class-validator';
import * as mongooseDelete from 'mongoose-delete';
import { ISoftDelete, audit, useFactoryOptions } from '../db';
import {
  CarePlan,
  CarePlanCompletionReason,
  CarePlanType,
  CareStatus,
  IsObjectId,
} from '@argus/hepiusClient';

/**************************************************************************************************
 ********************************** Input params for gql methods **********************************
 *************************************************************************************************/

@InputType()
export class UpdateCarePlanParams {
  @Field(() => String)
  @IsObjectId({ message: Errors.get(ErrorType.carePlanIdInvalid) })
  id: string;

  @Field(() => String, { nullable: true })
  notes?: string;

  @Field(() => CareStatus, { nullable: true })
  status?: CareStatus;

  @IsOptional()
  @IsDate()
  @Field(() => Date, { nullable: true })
  dueDate?: Date;

  @Prop({ type: String, enum: CarePlanCompletionReason })
  @Field(() => CarePlanCompletionReason, { nullable: true })
  completionReason?: CarePlanCompletionReason;

  @Prop()
  @Field(() => String, { nullable: true })
  completionNote?: string;
}

@InputType()
export class DeleteCarePlanParams {
  @Field(() => String)
  @IsObjectId({ message: Errors.get(ErrorType.carePlanIdInvalid) })
  id: string;

  @Field(() => String, { nullable: true })
  deletionNote?: string;
}

/**************************************************************************************************
 **************************************** Exported Schemas ****************************************
 *************************************************************************************************/

export type CarePlanDocument = CarePlan & Document & ISoftDelete<CarePlan>;
export const CarePlanDto = audit(
  SchemaFactory.createForClass(CarePlan).plugin(mongooseDelete, useFactoryOptions),
);

export type CarePlanTypeDocument = CarePlanType & Document;
export const CarePlanTypeDto = audit(
  SchemaFactory.createForClass(CarePlanType).plugin(mongooseDelete, useFactoryOptions),
);
