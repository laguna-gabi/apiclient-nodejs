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
  MemberRecordingDto,
  MemberResolver,
  MemberScheduler,
  MemberService,
  NotifyParams,
  NotifyParamsDto,
  Recording,
} from '.';
import { MongooseModule } from '@nestjs/mongoose';
import { HttpModule } from '@nestjs/axios';
import { Appointment, AppointmentDto } from '../appointment';
import { ConfigsService, ProvidersModule } from '../providers';
import { UserModule } from '../user';
import { CommunicationModule } from '../communication';

@Module({
  imports: [
    CommunicationModule,
    UserModule,
    ProvidersModule,
    HttpModule,
    MongooseModule.forFeature([
      { name: Member.name, schema: MemberDto },
      { name: Goal.name, schema: GoalDto },
      { name: ActionItem.name, schema: ActionItemDto },
      { name: MemberConfig.name, schema: MemberConfigDto },
      { name: Appointment.name, schema: AppointmentDto },
      { name: NotifyParams.name, schema: NotifyParamsDto },
      { name: Recording.name, schema: MemberRecordingDto },
    ]),
  ],
  providers: [MemberResolver, MemberService, MemberScheduler, ConfigsService],
  controllers: [MemberController],
})
export class MemberModule {}
