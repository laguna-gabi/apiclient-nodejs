import { Module } from '@nestjs/common';
import {
  ActionItem,
  ActionItemDto,
  Goal,
  GoalDto,
  Member,
  MemberConfig,
  MemberConfigDto,
  MemberController,
  MemberDto,
  MemberResolver,
  MemberService,
} from '.';
import { MongooseModule } from '@nestjs/mongoose';
import { HttpModule } from '@nestjs/axios';
import { Appointment, AppointmentDto } from '../appointment';
import { ConfigsService, ProvidersModule } from '../providers';
import { UserModule } from '../user';
import { SchedulerModule } from '../scheduler';
import { NotifyParams, NotifyParamsDto } from '../common';

@Module({
  imports: [
    UserModule,
    ProvidersModule,
    HttpModule,
    SchedulerModule,
    MongooseModule.forFeature([
      { name: Member.name, schema: MemberDto },
      { name: Goal.name, schema: GoalDto },
      { name: ActionItem.name, schema: ActionItemDto },
      { name: MemberConfig.name, schema: MemberConfigDto },
      { name: Appointment.name, schema: AppointmentDto },
      { name: NotifyParams.name, schema: NotifyParamsDto },
    ]),
  ],
  providers: [MemberResolver, MemberService, ConfigsService],
  controllers: [MemberController],
})
export class MemberModule {}
