import { Field, InputType, ObjectType, registerEnumType } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ISoftDelete, audit, useFactoryOptions } from '../db';
import * as mongooseDelete from 'mongoose-delete';
import { Identifier, IsObjectId, Scores } from '@argus/hepiusClient';
import { IsOptional } from 'class-validator';
import { ErrorType, Errors } from '../common';
import { DefaultSchemaOptions } from '@argus/pandora';
import { Org } from '../org';

/**************************************************************************************************
 ******************************* Enum registration for gql methods ********************************
 *************************************************************************************************/

export enum ReadmissionRisk {
  high = 'high',
  medium = 'medium',
  low = 'low',
}
registerEnumType(ReadmissionRisk, { name: 'ReadmissionRisk' });

/**************************************************************************************************
 ********************************** Input params for gql methods **********************************
 *************************************************************************************************/
@ObjectType()
export class ReadmissionRiskHistory {
  @Field(() => ReadmissionRisk, { nullable: true })
  readmissionRisk?: ReadmissionRisk;

  @Field(() => Date)
  date: Date;
}

@InputType()
export class UpdateJourneyParams {
  @Field(() => String)
  memberId: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  fellowName?: string;

  @Field(() => ReadmissionRisk, { nullable: true })
  @IsOptional()
  readmissionRisk?: ReadmissionRisk;
}

@InputType()
export class GraduateMemberParams {
  @Field(() => String)
  id: string;

  @Field(() => Boolean)
  isGraduated: boolean;
}

@InputType()
export class SetGeneralNotesParams {
  @Field(() => String)
  @IsObjectId({ message: Errors.get(ErrorType.memberIdInvalid) })
  memberId: string;

  @Field(() => String)
  note: string;
}

@InputType()
export class ReplaceMemberOrgParams {
  @Field(() => String)
  @IsObjectId({ message: Errors.get(ErrorType.memberIdInvalid) })
  memberId: string;

  journeyId?: string;

  @Field(() => String)
  @IsObjectId({ message: Errors.get(ErrorType.journeyOrgIdInvalid) })
  orgId: string;
}
/***************************************************************************************************
 ********************************* Return params for gql methods **********************************
 *************************************************************************************************/

@ObjectType()
@Schema(DefaultSchemaOptions)
export class Journey extends Identifier {
  @Prop({ type: Types.ObjectId, index: true })
  @Field(() => String)
  memberId: Types.ObjectId;

  /**
   * Org prop is moved to journey collection, but the field is still exposed via the member api
   * (since its in use by the app)
   * https://app.shortcut.com/laguna-health/story/5477/prepare-hepius-pre-post-app-break
   */
  @Prop({ type: Types.ObjectId, ref: Org.name, index: true })
  @Field(() => Org)
  org: Org;

  @Prop({ type: [{ type: Types.ObjectId }], default: [] })
  @Field(() => [String])
  admissions: Types.ObjectId[];

  @Prop({ type: Date })
  @Field(() => Date, { nullable: true })
  firstLoggedInAt?: Date;

  @Prop({ type: Date })
  @Field(() => Date, { nullable: true })
  lastLoggedInAt?: Date;

  @Prop({ isNaN: true })
  @Field(() => String, { nullable: true })
  fellowName?: string;

  @Prop({ type: String, enum: ReadmissionRisk, isNaN: true })
  @Field(() => ReadmissionRisk, { nullable: true })
  readmissionRisk?: ReadmissionRisk;

  @Prop({ isNan: true })
  @Field(() => [ReadmissionRiskHistory], { nullable: true })
  readmissionRiskHistory?: ReadmissionRiskHistory[];

  @Prop({ type: Boolean, default: false })
  @Field(() => Boolean)
  isGraduated: boolean;

  @Prop({ type: Date, isNaN: true })
  @Field(() => Date, { nullable: true })
  graduationDate?: Date;

  @Prop({ isNaN: true })
  @Field(() => String, { nullable: true })
  generalNotes?: string;

  @Prop({ isNaN: true })
  @Field(() => Scores, { nullable: true })
  scores?: Scores;
}

@Schema(DefaultSchemaOptions)
export class ControlJourney extends Journey {}

/**************************************************************************************************
 **************************************** Exported Schemas ****************************************
 *************************************************************************************************/
export type JourneyDocument = Journey & Document & ISoftDelete<Journey>;
export const JourneyDto = audit(
  SchemaFactory.createForClass(Journey).plugin(mongooseDelete, useFactoryOptions),
);
export type ControlJourneyDocument = ControlJourney & Document;
export const ControlJourneyDto = audit(SchemaFactory.createForClass(ControlJourney));
