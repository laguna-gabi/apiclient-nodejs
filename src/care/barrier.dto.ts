import { BarrierDomain, BaseCare, CarePlanType, CareStatus } from '.';
import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ErrorType, Errors, Identifier, IsObjectId } from '../common';
import { ISoftDelete } from '../db';

/**************************************************************************************************
 ********************************** Input params for gql methods **********************************
 *************************************************************************************************/

@InputType()
export class BaseBarrierParams {
  @Field(() => String)
  @IsObjectId({ message: Errors.get(ErrorType.barrierTypeInvalid) })
  type: string;

  @Field(() => String, { nullable: true })
  notes?: string;

  createdBy: string;
}

@InputType()
export class CreateBarrierParams extends BaseBarrierParams {
  @Field(() => String)
  @IsObjectId({ message: Errors.get(ErrorType.redFlagIdInvalid) })
  redFlagId: string;

  @Field(() => String)
  @IsObjectId({ message: Errors.get(ErrorType.memberIdInvalid) })
  memberId: string;
}

@InputType()
export class UpdateBarrierParams {
  @Field(() => String)
  @IsObjectId({ message: Errors.get(ErrorType.barrierIdInvalid) })
  id: string;

  @Field(() => String, { nullable: true })
  notes?: string;

  @Field(() => CareStatus, { nullable: true })
  status?: CareStatus;

  @Field(() => String, { nullable: true })
  @IsObjectId({ message: Errors.get(ErrorType.barrierTypeInvalid) })
  type?: string;
}

/**************************************************************************************************
 ********************************* Return params for gql methods **********************************
 *************************************************************************************************/

@ObjectType()
@Schema({ versionKey: false, timestamps: true })
export class BarrierType extends Identifier {
  @Prop()
  @Field(() => String)
  description: string;

  @Prop()
  @Field(() => BarrierDomain, { nullable: true })
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
  @Field(() => String)
  redFlagId: Types.ObjectId;
}

/**************************************************************************************************
 **************************************** Exported Schemas ****************************************
 *************************************************************************************************/
export type BarrierDocument = Barrier & Document & ISoftDelete<BarrierType>;
export const BarrierDto = SchemaFactory.createForClass(Barrier);

export type BarrierTypeDocument = BarrierType & Document;
export const BarrierTypeDto = SchemaFactory.createForClass(BarrierType);
