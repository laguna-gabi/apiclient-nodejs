import { Module } from '@nestjs/common';
import {
  ActionItem,
  ActionItemDto,
  Goal,
  GoalDto,
  Member,
  MemberConfig,
  MemberConfigDto,
  MemberDto,
  MemberResolver,
  MemberService,
} from '.';
import { MongooseModule } from '@nestjs/mongoose';
import { HttpModule } from '@nestjs/axios';
import { Appointment, AppointmentDto } from '../appointment';
import { ConfigsService, ProvidersModule } from '../providers';
import { UserModule } from '../user';

@Module({
  imports: [
    UserModule,
    ProvidersModule,
    HttpModule,
    MongooseModule.forFeature([
      { name: Member.name, schema: MemberDto },
      { name: Goal.name, schema: GoalDto },
      { name: ActionItem.name, schema: ActionItemDto },
      { name: MemberConfig.name, schema: MemberConfigDto },
      { name: Appointment.name, schema: AppointmentDto },
    ]),
  ],
  providers: [MemberResolver, MemberService, ConfigsService],
})
export class MemberModule {}
