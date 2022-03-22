import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ErrorType, Errors, Identifier, IsObjectId, IsValidCarePlanTypeInput } from '../common';
import { CareStatus } from '.';
import { IsDate, IsOptional } from 'class-validator';
import * as mongooseDelete from 'mongoose-delete';
import { ISoftDelete, audit, useFactoryOptions } from '../db';

/**************************************************************************************************
 ********************************** Input params for gql methods **********************************
 *************************************************************************************************/

/**
 * Each CarePlan for a member has a specific type, which represents the chosen plan.
 * CarePlan can be created in 1 of 2 ways:
 * 1. Care Plan of a known type - CarePlanType, that already exists in the db (and is represented by an objectId).
 * 2. Creating a custom care plan - which has a new description, and will inserted as a new CarePlanType.
 * When creating a CarePlan - only one of them can can be used (either id of custom).
 */
@InputType()
export class CarePlanTypeInput {
  @Field(() => String, { nullable: true })
  @IsObjectId({ message: Errors.get(ErrorType.carePlanTypeInvalid) })
  id?: string; // NULL if custom CarePlan

  @Field(() => String, { nullable: true })
  custom?: string; // NULL if known type
}

@InputType()
export class BaseCarePlanParams {
  @Field(() => CarePlanTypeInput)
  @IsValidCarePlanTypeInput({ message: Errors.get(ErrorType.carePlanTypeInputInvalid) })
  type: CarePlanTypeInput;

  @Field(() => String, { nullable: true })
  notes?: string;

  @IsOptional()
  @IsDate()
  @Field(() => Date, { nullable: true })
  dueDate?: Date;
}

@InputType()
export class CreateCarePlanParams extends BaseCarePlanParams {
  @Field(() => String)
  @IsObjectId({ message: Errors.get(ErrorType.barrierIdInvalid) })
  barrierId: string;

  @Field(() => String)
  @IsObjectId({ message: Errors.get(ErrorType.memberIdInvalid) })
  memberId: string;
}

@InputType()
export class UpdateCarePlanParams {
  @Field(() => String)
  @IsObjectId({ message: Errors.get(ErrorType.carePlanIdInvalid) })
  id: string;

  @Field(() => String, { nullable: true })
  notes?: string;

  @Field(() => CareStatus, { nullable: true })
  status?: CareStatus;
}

/**************************************************************************************************
 ********************************* Return params for gql methods **********************************
 *************************************************************************************************/

@ObjectType()
@Schema({ versionKey: false, timestamps: true })
export class CarePlanType extends Identifier {
  @Prop()
  @Field(() => String)
  description: string;

  @Prop()
  @Field(() => Boolean)
  isCustom: boolean;
}

@ObjectType()
@Schema({ versionKey: false, timestamps: true })
export class BaseCare extends Identifier {
  @Prop({ index: true, type: Types.ObjectId })
  @Field(() => String)
  memberId: Types.ObjectId;

  @Prop({ type: Types.ObjectId })
  @Field(() => String)
  createdBy: Types.ObjectId;

  @Field(() => Date)
  createdAt: Date;

  @Field(() => Date)
  updatedAt: Date;

  @Prop({ index: true, type: String, enum: CareStatus, default: CareStatus.active })
  @Field(() => CareStatus)
  status: CareStatus;

  @Prop()
  @Field(() => String, { nullable: true })
  notes?: string;

  @Prop()
  @Field(() => Date, { nullable: true })
  completedAt?: Date;
}

@ObjectType()
@Schema({ versionKey: false, timestamps: true })
export class CarePlan extends BaseCare {
  @Prop({ type: Types.ObjectId, ref: CarePlanType.name, index: true })
  @Field(() => CarePlanType)
  type: CarePlanType;

  @Prop({ index: true, type: Types.ObjectId })
  @Field(() => String)
  barrierId?: Types.ObjectId;

  @Prop({ type: Date })
  @Field(() => Date, { nullable: true })
  dueDate?: Date;
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
