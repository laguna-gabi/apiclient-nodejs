import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { IsBoolean, IsOptional } from 'class-validator';
import { Document } from 'mongoose';
import { ErrorType, Errors, IsNoShowValid, IsObjectId } from '../common';

/**************************************************************************************************
 ********************************** Input params for gql methods **********************************
 *************************************************************************************************/
@InputType('ScoresInput')
@ObjectType()
@Schema()
export class Scores {
  @Prop({ isNaN: true })
  @Field(() => Number, { nullable: true })
  adherence?: number;

  @Prop({ isNaN: true })
  @Field(() => String, { nullable: true })
  adherenceText?: string;

  @Prop({ isNaN: true })
  @Field(() => Number, { nullable: true })
  wellbeing?: number;

  @Prop({ isNaN: true })
  @Field(() => String, { nullable: true })
  wellbeingText?: string;
}

/**************************************************************************************************
 ********************************* Return params for gql methods **********************************
 *************************************************************************************************/
@InputType('NotesInput')
@ObjectType()
@Schema({ versionKey: false, timestamps: true })
export class Notes {
  @Prop({ isNaN: true })
  @Field(() => String, { nullable: true })
  recap?: string;

  @Prop({ isNaN: true })
  @Field(() => String, { nullable: true })
  strengths?: string;

  @Prop({ isNaN: true })
  @Field(() => String, { nullable: true })
  userActionItem?: string;

  @Prop({ isNaN: true })
  @Field(() => String, { nullable: true })
  memberActionItem?: string;

  @Prop({ isNan: true })
  @Field(() => Scores, { nullable: true })
  scores?: Scores;
}

/**************************************************************************************************
 ********************************** Input params for gql methods **********************************
 *************************************************************************************************/
@InputType()
@ObjectType()
export class EndAppointmentParams {
  @Field(() => String)
  @IsObjectId({ message: Errors.get(ErrorType.appointmentIdInvalid) })
  id: string;

  @Field(() => Notes, { nullable: true })
  @IsOptional()
  notes?: Notes;

  @Field(() => Boolean, { nullable: true })
  @IsOptional()
  @IsBoolean()
  noShow?: boolean;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsNoShowValid({ message: Errors.get(ErrorType.appointmentNoShow) })
  noShowReason?: string;

  @Field(() => Boolean, { nullable: true })
  @IsOptional()
  recordingConsent?: boolean;
}

@InputType()
export class UpdateNotesParams {
  @Field(() => String)
  @IsObjectId({ message: Errors.get(ErrorType.appointmentIdInvalid) })
  appointmentId: string;

  @Field(() => Notes, { nullable: true })
  notes?: Notes;
}

/**************************************************************************************************
 **************************************** Exported Schemas ****************************************
 *************************************************************************************************/
export type NotesDocument = Notes & Document;
export const NotesDto = SchemaFactory.createForClass(Notes);
