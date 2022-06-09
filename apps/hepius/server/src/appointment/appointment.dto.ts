import { Appointment, AppointmentMethod, IsObjectId } from '@argus/hepiusClient';
import { Field, InputType } from '@nestjs/graphql';
import { SchemaFactory } from '@nestjs/mongoose';
import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { Document } from 'mongoose';
import * as mongooseDelete from 'mongoose-delete';
import { ErrorType, Errors, IsDateAfter, IsDateInNotificationRange, IsFutureDate } from '../common';
import { ISoftDelete, audit, useFactoryOptions } from '../db';

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

  journeyId?: string;
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

  journeyId?: string;
}

/**************************************************************************************************
 **************************************** Exported Schemas ****************************************
 *************************************************************************************************/
export type AppointmentDocument = Appointment & Document & ISoftDelete<Appointment>;
export const AppointmentDto = audit(
  SchemaFactory.createForClass(Appointment).plugin(mongooseDelete, useFactoryOptions),
);
