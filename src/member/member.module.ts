import { Module } from '@nestjs/common';
import {
  ActionItem,
  ActionItemDto,
  Goal,
  GoalDto,
  Member,
  MemberDto,
  MemberResolver,
  MemberService,
} from '.';
import { MongooseModule } from '@nestjs/mongoose';
import { Appointment, AppointmentDto } from '../appointment';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Member.name, schema: MemberDto },
      { name: Goal.name, schema: GoalDto },
      { name: ActionItem.name, schema: ActionItemDto },
      { name: Appointment.name, schema: AppointmentDto },
    ]),
  ],
  providers: [MemberResolver, MemberService],
})
export class MemberModule {}
