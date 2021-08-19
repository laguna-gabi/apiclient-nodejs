import { Field, InputType, Int, ObjectType } from '@nestjs/graphql';
import { AppointmentMethod } from '../appointment';
import { UserRole } from '.';
import { Identifier } from '../common';
import { IsDate, IsOptional } from 'class-validator';

export const defaultSlotsParams = {
  duration: 30,
  maxSlots: 9,
};

export const NotNullableSlotsKeys = ['notBefore'];

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

  @Field(() => AppointmentSlotSummary)
  appointment: AppointmentSlotSummary;

  @Field(() => MemberSlotSummary)
  member: MemberSlotSummary;

  @Field(() => [Date], { nullable: 'items' })
  slots: Date[];
}

@InputType()
export class GetSlotsParams {
  @Field(() => String)
  appointmentId: string;

  @IsOptional()
  @IsDate()
  @Field(() => Date, { nullable: true })
  notBefore?: Date;
}
