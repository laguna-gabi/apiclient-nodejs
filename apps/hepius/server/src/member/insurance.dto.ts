import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { ISoftDelete, audit, useFactoryOptions } from '../db';
import * as mongooseDelete from 'mongoose-delete';
import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { ErrorType, Errors, IsDateAfter, onlyDateRegex } from '../common';
import { Matches } from 'class-validator';
import { Identifier, IsObjectId } from '@argus/hepiusClient';

/********∏******************************************************************************************
 ********************************* Return params for gql methods **********************************
 *************************************************************************************************/
@ObjectType()
@Schema({ versionKey: false, timestamps: true })
export class Insurance extends Identifier {
  @Prop({ index: true, type: Types.ObjectId })
  @Field()
  memberId: Types.ObjectId;

  @Prop()
  @Field()
  type: string;

  @Prop()
  @Field(() => String)
  name: string;

  @Prop({ isNan: true })
  @Field({ nullable: true })
  startDate?: string;

  @Prop({ isNan: true })
  @Field({ nullable: true })
  endDate?: string;
}

/**************************************************************************************************
 ********************************** Input params for gql methods **********************************
 *************************************************************************************************/

@InputType()
export class AddInsuranceParams {
  @Field({ nullable: true })
  @IsObjectId({ message: Errors.get(ErrorType.memberIdInvalid) })
  memberId?: string;

  @Field()
  type: string;

  @Field()
  name: string;

  @Field({ nullable: true })
  @Matches(onlyDateRegex, { message: Errors.get(ErrorType.insuranceStartDate) })
  startDate?: string;

  @Field({ nullable: true })
  @Matches(onlyDateRegex, { message: Errors.get(ErrorType.insuranceEndDate) })
  @IsDateAfter('startDate', {
    message: Errors.get(ErrorType.appointmentEndAfterStart),
  })
  endDate?: string;
}

/**************************************************************************************************
 **************************************** Exported Schemas ****************************************
 *************************************************************************************************/
export type InsuranceDocument = Insurance & Document & ISoftDelete<Insurance>;
export const InsuranceDto = audit(
  SchemaFactory.createForClass(Insurance).plugin(mongooseDelete, useFactoryOptions),
);
