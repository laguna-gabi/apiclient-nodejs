import { Field, InputType, Int, ObjectType } from '@nestjs/graphql';
import { IsDate, IsOptional } from 'class-validator';
import { Types } from 'mongoose';
import { ErrorType, Errors, IsUserIdOrAppointmentId } from '../common';
import { AppointmentMethod, Identifier, IsObjectId, UserRole } from '@argus/hepiusClient';

export const defaultSlotsParams = {
  duration: 30,
  maxSlots: 18,
  defaultSlots: 12,
};

export const NotNullableSlotsKeys = ['notBefore', 'userId', 'appointmentId'];

@ObjectType()
export class UserSlotSummary extends Identifier {
  @Field(() => String)
  firstName: string;

  @Field(() => [UserRole], {
    description: 'role of the user: admin/user/nurse/nutrition/doctor/...',
  })
  roles: UserRole[];

  @Field(() => String)
  avatar: string;

  @Field(() => String)
  description: string;
}

@ObjectType()
export class AppointmentSlotSummary extends Identifier {
  @Field(() => Int)
  duration: number;

  @Field(() => Date)
  start: Date;

  @Field(() => AppointmentMethod)
  method: AppointmentMethod;

  @Field(() => String)
  memberId: Types.ObjectId;

  @Field(() => String)
  userId: Types.ObjectId;
}

@ObjectType()
export class MemberSlotSummary extends Identifier {
  @Field(() => String)
  firstName: string;
}

@ObjectType()
export class Slots {
  @Field(() => UserSlotSummary)
  user: UserSlotSummary;

  @Field(() => AppointmentSlotSummary, { nullable: true })
  appointment?: AppointmentSlotSummary;

  @Field(() => MemberSlotSummary, { nullable: true })
  member?: MemberSlotSummary;

  @Field(() => [Date])
  slots: Date[];
}

@InputType()
export class GetSlotsParams {
  @Field(() => String, { nullable: true })
  @IsUserIdOrAppointmentId({ message: Errors.get(ErrorType.slotsParams) })
  @IsObjectId({ message: Errors.get(ErrorType.userIdInvalid) })
  userId?: string;

  @Field(() => String, { nullable: true })
  @IsObjectId({ message: Errors.get(ErrorType.appointmentIdInvalid) })
  appointmentId?: string;

  @IsOptional()
  @IsDate()
  @Field(() => Date, { nullable: true })
  notBefore?: Date;

  @IsOptional()
  @IsDate()
  @Field(() => Date, { nullable: true })
  notAfter?: Date;

  @IsOptional()
  @Field(() => Boolean, { nullable: true })
  allowEmptySlotsResponse?: boolean;

  @IsOptional()
  @Field(() => Number, { defaultValue: defaultSlotsParams.defaultSlots })
  defaultSlotsCount?: number;

  @IsOptional()
  @Field(() => Number, { defaultValue: defaultSlotsParams.maxSlots })
  maxSlots?: number;

  orgIds?: string[];
}
