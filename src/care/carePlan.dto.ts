import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ErrorType, Errors, IsCustomOrSuggestedCarePlan, IsObjectId } from '../common';
import { BaseCare, CarePlanType, CareStatus } from '.';

/**************************************************************************************************
 ********************************** Input params for gql methods **********************************
 *************************************************************************************************/

@InputType()
export class CreateCarePlanParams {
  @Field(() => String)
  @IsObjectId({ message: Errors.get(ErrorType.memberIdInvalid) })
  memberId: string;

  @Field(() => CarePlanType, { nullable: true })
  @IsCustomOrSuggestedCarePlan({ message: Errors.get(ErrorType.carePlanTypeOrCustomInvalid) })
  carePlanType?: CarePlanType; // NULL if custom CarePlan

  @Field(() => String, { nullable: true })
  notes?: string;

  @Field(() => String, { nullable: true })
  @IsObjectId({ message: Errors.get(ErrorType.barrierIdInvalid) })
  barrierId?: string; // NULL if independent CarePlan

  @Prop()
  @Field(() => String, { nullable: true })
  customValue?: string; // NULL if known CarePlanType

  @Prop({ type: Date })
  @Field(() => Date, { nullable: true })
  dueDate?: Date;

  createdBy: string;
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
export class CarePlan extends BaseCare {
  @Prop({ index: true, type: CarePlanType })
  @Field(() => CarePlanType, { nullable: true })
  carePlanType?: CarePlanType;

  @Prop({ index: true, type: Types.ObjectId })
  @Field(() => String)
  barrierId?: Types.ObjectId;

  @Prop({ type: Date })
  @Field(() => Date, { nullable: true })
  dueDate?: Date;

  @Prop()
  @Field(() => String, { nullable: true })
  customValue?: string;
}

/**************************************************************************************************
 **************************************** Exported Schemas ****************************************
 *************************************************************************************************/

export type CarePlanDocument = CarePlan & Document;
export const CarePlanDto = SchemaFactory.createForClass(CarePlan);
