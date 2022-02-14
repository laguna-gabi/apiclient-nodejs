import { BarrierType, CareStatus } from '.';
import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ErrorType, Errors, Identifier, IsObjectId } from '../common';

/**************************************************************************************************
 ********************************** Input params for gql methods **********************************
 *************************************************************************************************/

@InputType()
export class CreateBarrierParams {
  @Field(() => String)
  @IsObjectId({ message: Errors.get(ErrorType.memberIdInvalid) })
  memberId: string;

  @Field(() => BarrierType)
  barrierType: BarrierType;

  @Field(() => String, { nullable: true })
  notes?: string;

  @Field(() => String, { nullable: true })
  @IsObjectId({ message: Errors.get(ErrorType.redFlagIdInvalid) })
  redFlagId?: string;

  createdBy: string;
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
}

/**************************************************************************************************
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
export class Barrier extends BaseCare {
  @Prop({ index: true, type: String, enum: BarrierType })
  @Field(() => BarrierType)
  barrierType: BarrierType;

  @Prop({ index: true, type: Types.ObjectId })
  @Field(() => String)
  redFlagId: Types.ObjectId;
}

/**************************************************************************************************
 **************************************** Exported Schemas ****************************************
 *************************************************************************************************/
export type BarrierDocument = Barrier & Document;
export const BarrierDto = SchemaFactory.createForClass(Barrier);
