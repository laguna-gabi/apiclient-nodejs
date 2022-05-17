import { Field, ObjectType } from '@nestjs/graphql';
import { Prop, Schema } from '@nestjs/mongoose';
import { Identifier } from './common';
import { Types } from 'mongoose';

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

export enum CareStatus {
  active = 'active',
  completed = 'completed',
}

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

@ObjectType()
@Schema({ versionKey: false, timestamps: true })
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
@Schema({ versionKey: false, timestamps: true })
export class Barrier extends BaseCare {
  @Prop({ type: Types.ObjectId, ref: BarrierType.name, index: true })
  @Field(() => BarrierType)
  type: BarrierType;

  @Prop({ index: true, type: Types.ObjectId })
  @Field(() => String, { nullable: true })
  redFlagId?: Types.ObjectId;
}
