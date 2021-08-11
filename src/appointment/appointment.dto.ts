import { Field, InputType, ObjectType, OmitType, registerEnumType } from '@nestjs/graphql';
import { IsBoolean, IsDate } from 'class-validator';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Errors, ErrorType, Identifier, IsDateAfter, IsFutureDate, IsNoShowValid } from '../common';
import { Document, Types } from 'mongoose';
import { Notes } from './note.dto';

/**************************************************************************************************
 ******************************* Enum registration for gql methods ********************************
 *************************************************************************************************/
export enum AppointmentStatus {
  requested = 'requested',
  scheduled = 'scheduled',
  done = 'done',
  closed = 'closed',
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
}

@InputType()
export class ScheduleAppointmentParams {
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

  @Field(() => AppointmentMethod)
  method: AppointmentMethod;

  @Field(() => Date)
  @IsDate({ message: Errors.get(ErrorType.appointmentStartDate) })
  start: Date;

  @Field(() => Date)
  @IsDateAfter('start', {
    message: Errors.get(ErrorType.appointmentEndAfterStart),
  })
  @IsDate({ message: Errors.get(ErrorType.appointmentEndDate) })
  end: Date;
}

@InputType()
@ObjectType('NoShowType')
export class NoShow {
  @Field(() => Boolean)
  @IsBoolean()
  noShow: boolean;

  @Field(() => String, { nullable: true })
  @IsNoShowValid('noShow', { message: Errors.get(ErrorType.appointmentNoShow) })
  reason?: string;
}

@InputType()
export class NoShowParams extends NoShow {
  @Field(() => String)
  id: string;
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

  @Prop()
  @Field(() => Date)
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

  @Prop({ type: NoShow })
  @Field(() => NoShow, { nullable: true })
  noShow?: NoShow;

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
