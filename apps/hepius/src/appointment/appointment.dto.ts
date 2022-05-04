import { Field, InputType, ObjectType, OmitType, registerEnumType } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { Document, Types } from 'mongoose';
import {
  ErrorType,
  Errors,
  Identifier,
  IsDateAfter,
  IsDateInNotificationRange,
  IsFutureDate,
  IsObjectId,
} from '../common';
import { Notes } from '.';
import { ISoftDelete, audit, useFactoryOptions } from '../db';
import * as mongooseDelete from 'mongoose-delete';

/**************************************************************************************************
 ******************************* Enum registration for gql methods ********************************
 *************************************************************************************************/
export enum AppointmentStatus {
  requested = 'requested',
  scheduled = 'scheduled',
  done = 'done',
}

registerEnumType(AppointmentStatus, { name: 'AppointmentStatus' });

export enum AppointmentMethod {
  chat = 'chat',
  phoneCall = 'phoneCall',
  videoCall = 'videoCall',
}

registerEnumType(AppointmentMethod, { name: 'AppointmentMethod' });

/**************************************************************************************************
 ********************************** Input params for gql methods **********************************
 *************************************************************************************************/
@InputType()
export class RequestAppointmentParams {
  @Field(() => String)
  @IsObjectId({ message: Errors.get(ErrorType.memberIdInvalid) })
  memberId: string;

  @Field(() => String)
  @IsObjectId({ message: Errors.get(ErrorType.userIdInvalid) })
  userId: string;

  @Field(() => Date)
  @IsFutureDate({
    message: Errors.get(ErrorType.appointmentNotBeforeDateInThePast),
  })
  @IsDateInNotificationRange({ message: Errors.get(ErrorType.appointmentNotBeforeDateOutOfRange) })
  @IsDate({ message: Errors.get(ErrorType.appointmentNotBeforeDate) })
  notBefore: Date;

  // @Field(() => String, { nullable: true })
  @IsString()
  @IsOptional()
  id?: string;
}

@InputType()
export class ScheduleAppointmentParams {
  @Field(() => String, { nullable: true })
  @IsNotEmpty() /* for rest api */
  @IsString() /* for rest api */
  @IsObjectId({ message: Errors.get(ErrorType.memberIdInvalid) })
  memberId?: string;

  @Field(() => String)
  @IsNotEmpty() /* for rest api */
  @IsString() /* for rest api */
  @IsObjectId({ message: Errors.get(ErrorType.userIdInvalid) })
  userId: string;

  @Field(() => AppointmentMethod)
  @IsNotEmpty() /* for rest api */
  @IsEnum(AppointmentMethod) /* for rest api */
  method: AppointmentMethod;

  @Field(() => Date)
  @Type(() => Date) /* for rest api */
  @IsDateInNotificationRange({ message: Errors.get(ErrorType.appointmentStartDateOutOfRange) })
  @IsDate({ message: Errors.get(ErrorType.appointmentStartDate) })
  @IsNotEmpty() /* for rest api */
  start: Date;

  @Field(() => Date)
  @Type(() => Date) /* for rest api */
  @IsDateAfter('start', {
    message: Errors.get(ErrorType.appointmentEndAfterStart),
  })
  @IsDate({ message: Errors.get(ErrorType.appointmentEndDate) })
  @IsNotEmpty() /* for rest api */
  end: Date;

  @Field(() => String, { nullable: true })
  @IsString() /* for rest api */
  @IsOptional() /* for rest api */
  id?: string;
}

/**************************************************************************************************
 ********************************* Return params for gql methods **********************************
 *************************************************************************************************/
@ObjectType()
@Schema({ versionKey: false, timestamps: true })
export class Appointment extends Identifier {
  @Prop({ index: true, type: Types.ObjectId })
  @Field(() => String)
  userId: Types.ObjectId;

  @Prop({ index: true, type: Types.ObjectId })
  @Field(() => String)
  memberId: Types.ObjectId;

  @Prop({ isNaN: true })
  @Field(() => Date, { nullable: true })
  notBefore: Date;

  @Prop({ type: String, enum: AppointmentStatus })
  @Field(() => AppointmentStatus)
  status: AppointmentStatus;

  @Prop({ type: String, enum: AppointmentMethod })
  @Field(() => AppointmentMethod, { nullable: true })
  method?: AppointmentMethod;

  @Prop()
  @Field(() => Date, { nullable: true })
  start?: Date;

  @Prop()
  @Field(() => Date, { nullable: true })
  end?: Date;

  @Prop({ isNan: true })
  @Field(() => Boolean, { nullable: true })
  noShow?: boolean;

  @Prop({ isNaN: true })
  @Field(() => String, { nullable: true })
  noShowReason?: string;

  @Prop({ isNaN: true })
  @Field(() => Boolean, { nullable: true })
  recordingConsent?: boolean;

  @Prop({ type: Types.ObjectId, ref: Notes.name })
  @Field(() => Notes, { nullable: true })
  notes?: Notes;

  @Field(() => Date)
  updatedAt: Date;

  @Field(() => Date)
  createdAt: Date;

  @Prop()
  @Field(() => String)
  link: string;
}

@ObjectType()
export class AppointmentData extends OmitType(Appointment, ['userId', 'memberId']) {}

/**************************************************************************************************
 **************************************** Exported Schemas ****************************************
 *************************************************************************************************/
export type AppointmentDocument = Appointment & Document & ISoftDelete<Appointment>;
export const AppointmentDto = audit(
  SchemaFactory.createForClass(Appointment).plugin(mongooseDelete, useFactoryOptions),
);
