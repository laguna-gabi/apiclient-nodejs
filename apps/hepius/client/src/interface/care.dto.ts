import { Field, InputType, ObjectType, registerEnumType } from '@nestjs/graphql';
import { Prop, Schema } from '@nestjs/mongoose';
import { Identifier } from '.';
import { Types } from 'mongoose';
import { IsObjectId, IsValidCarePlanTypeInput } from '../customValidations';
import { ErrorType, Errors } from '../errors';
import { IsDate, IsOptional } from 'class-validator';
import { DefaultSchemaOptions } from '@argus/pandora';

/**************************************************************************************************
 ********************************************** Enums *********************************************
 *************************************************************************************************/

export enum BarrierDomain {
  mobility = 'mobility',
  environment = 'environment',
  medical = 'medical',
  behavior = 'behavior',
  logistical = 'logistical',
  emotional = 'emotional',
}
registerEnumType(BarrierDomain, { name: 'BarrierCategory' });

export enum BarrierStatus {
  active = 'active',
  completed = 'completed',
}
registerEnumType(BarrierStatus, { name: 'BarrierStatus' });

export enum CarePlanStatus {
  active = 'active',
  completed = 'completed',
  noLongerAppropriate = 'noLongerAppropriate',
  refusedByMember = 'refusedByMember',
  memberDischarged = 'memberDischarged',
}
registerEnumType(CarePlanStatus, { name: 'CarePlanStatus' });

/********∏******************************************************************************************
 ********************************* Return params for gql methods **********************************
 *************************************************************************************************/

@ObjectType()
@Schema({ versionKey: false, timestamps: true })
export class BaseCare extends Identifier {
  @Prop({ index: true, type: Types.ObjectId })
  @Field(() => String)
  memberId: Types.ObjectId;

  @Prop({ type: Types.ObjectId })
  @Field(() => String, { nullable: true })
  createdBy?: Types.ObjectId;

  @Field(() => Date)
  createdAt: Date;

  @Field(() => Date)
  updatedAt: Date;

  @Prop()
  @Field(() => String, { nullable: true })
  notes?: string;

  @Prop()
  @Field(() => Date, { nullable: true })
  completedAt?: Date;
}

@ObjectType()
@Schema(DefaultSchemaOptions)
export class CarePlanType extends Identifier {
  @Prop()
  @Field(() => String)
  description: string;

  @Prop()
  @Field(() => Boolean)
  isCustom: boolean;
}

@ObjectType()
@Schema(DefaultSchemaOptions)
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

  @Prop({ type: String, enum: CarePlanStatus, default: CarePlanStatus.active })
  @Field(() => CarePlanStatus)
  status: CarePlanStatus;

  @Prop()
  @Field(() => String, { nullable: true })
  deletionNote?: string;

  @Prop()
  @Field(() => String, { nullable: true })
  completionNote?: string;
}

@ObjectType()
@Schema(DefaultSchemaOptions)
export class BarrierType extends Identifier {
  @Prop()
  @Field(() => String)
  description: string;

  @Prop({ type: String, enum: BarrierDomain })
  @Field(() => BarrierDomain)
  domain: BarrierDomain;

  @Prop({ type: [{ type: Types.ObjectId, ref: CarePlanType.name }] })
  @Field(() => [CarePlanType])
  carePlanTypes: CarePlanType[];
}

@ObjectType()
@Schema(DefaultSchemaOptions)
export class Barrier extends BaseCare {
  @Prop({ type: Types.ObjectId, ref: BarrierType.name, index: true })
  @Field(() => BarrierType)
  type: BarrierType;

  @Prop({ index: true, type: Types.ObjectId })
  @Field(() => String, { nullable: true })
  redFlagId?: Types.ObjectId;

  @Prop({ type: String, enum: BarrierStatus, default: BarrierStatus.active })
  @Field(() => BarrierStatus)
  status: BarrierStatus;
}

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
