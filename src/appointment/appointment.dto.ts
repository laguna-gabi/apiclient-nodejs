import { Field, InputType, ObjectType, OmitType, registerEnumType } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { Document, Types } from 'mongoose';
import { ErrorType, Errors, Identifier, IsDateAfter, IsFutureDate } from '../common';
import { Notes } from '.';

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
  memberId: string;

  @Field(() => String)
  userId: string;

  @Field(() => Date)
  @IsFutureDate({
    message: Errors.get(ErrorType.appointmentNotBeforeDateInThePast),
  })
  @IsDate({ message: Errors.get(ErrorType.appointmentNotBeforeDate) })
  notBefore: Date;

  // @Field(() => String, { nullable: true })
  @IsString()
  @IsOptional()
  id?: string;
}

@InputType()
export class ScheduleAppointmentParams {
  @Field(() => String)
  @IsNotEmpty() /* for rest api */
  @IsString() /* for rest api */
  memberId: string;

  @Field(() => String)
  @IsNotEmpty() /* for rest api */
  @IsString() /* for rest api */
  userId: string;

  @Field(() => AppointmentMethod)
  @IsNotEmpty() /* for rest api */
  @IsEnum(AppointmentMethod) /* for rest api */
  method: AppointmentMethod;

  @Field(() => Date)
  @Type(() => Date) /* for rest api */
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
  @Prop({ index: true })
  @Field(() => String)
  userId: string;

  @Prop({ index: true, type: Types.ObjectId })
  @Field(() => String)
  memberId: Types.ObjectId;

  @Prop({ isNaN: true })
  @Field(() => Date, { nullable: true })
  notBefore: Date;

  @Prop()
  @Field(() => AppointmentStatus)
  status: AppointmentStatus;

  @Prop()
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

  @Prop({ type: Types.ObjectId, ref: Notes.name })
  @Field(() => Notes, { nullable: true })
  notes?: Notes;

  @Field(() => Date)
  updatedAt: Date;

  @Prop()
  @Field(() => String)
  link: string;
}

@ObjectType()
export class AppointmentData extends OmitType(Appointment, ['userId', 'memberId']) {}

/**************************************************************************************************
 **************************************** Exported Schemas ****************************************
 *************************************************************************************************/
export type AppointmentDocument = Appointment & Document;
export const AppointmentDto = SchemaFactory.createForClass(Appointment);
