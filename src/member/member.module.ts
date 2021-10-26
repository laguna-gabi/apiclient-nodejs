import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  ActionItem,
  ActionItemDto,
  ArchiveMember,
  ArchiveMemberConfig,
  ArchiveMemberConfigDto,
  ArchiveMemberDto,
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
  NotificationBuilder,
  NotifyParams,
  NotifyParamsDto,
  Recording,
} from '.';
import { Appointment, AppointmentDto } from '../appointment';
import { CommonModule } from '../common';
import { CommunicationModule } from '../communication';
import { ConfigsService, ProvidersModule } from '../providers';
import { InternalSchedulerModule } from '../scheduler';
import { UserModule } from '../user';

@Module({
  imports: [
    CommunicationModule,
    UserModule,
    InternalSchedulerModule,
    ProvidersModule,
    HttpModule,
    CommonModule,
    MongooseModule.forFeature([
      { name: Member.name, schema: MemberDto },
      { name: Goal.name, schema: GoalDto },
      { name: ActionItem.name, schema: ActionItemDto },
      { name: MemberConfig.name, schema: MemberConfigDto },
      { name: Appointment.name, schema: AppointmentDto },
      { name: NotifyParams.name, schema: NotifyParamsDto },
      { name: Recording.name, schema: MemberRecordingDto },
      { name: ArchiveMember.name, schema: ArchiveMemberDto },
      { name: ArchiveMemberConfig.name, schema: ArchiveMemberConfigDto },
    ]),
  ],
  providers: [MemberResolver, MemberService, NotificationBuilder, MemberScheduler, ConfigsService],
  controllers: [MemberController],
})
export class MemberModule {}
