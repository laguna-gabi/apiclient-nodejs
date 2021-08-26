import { Field, InputType, Int, ObjectType } from '@nestjs/graphql';
import { AppointmentMethod } from '../appointment';
import { UserRole } from '.';
import { Errors, ErrorType, Identifier, IsUserIdOrAppointmentId } from '../common';
import { IsDate, IsOptional } from 'class-validator';

export const defaultSlotsParams = {
  duration: 30,
  maxSlots: 9,
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
  userId?: string;

  @Field(() => String, { nullable: true })
  appointmentId?: string;

  @IsOptional()
  @IsDate()
  @Field(() => Date, { nullable: true })
  notBefore?: Date;
}
