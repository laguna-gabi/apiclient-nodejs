import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { SchemaFactory } from '@nestjs/mongoose';
import { IsBoolean, IsOptional } from 'class-validator';
import { Document } from 'mongoose';
import { ErrorType, Errors, IsNoShowValid, IsObjectId } from '../common';
import { ISoftDelete, audit, useFactoryOptions } from '../db';
import * as mongooseDelete from 'mongoose-delete';
import { Notes } from '@argus/hepiusClient';

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
export type NotesDocument = Notes & Document & ISoftDelete<Notes>;
export const NotesDto = audit(
  SchemaFactory.createForClass(Notes).plugin(mongooseDelete, useFactoryOptions),
);
