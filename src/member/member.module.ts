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
  Caregiver,
  CaregiverDto,
  ControlMember,
  ControlMemberDto,
  DismissedAlert,
  DismissedAlertDto,
  Goal,
  GoalDto,
  Journal,
  JournalDto,
  Member,
  MemberConfig,
  MemberConfigDto,
  MemberController,
  MemberDto,
  MemberRecordingDto,
  MemberResolver,
  MemberService,
  Recording,
} from '.';
import { Appointment, AppointmentDto } from '../appointment';
import { CommonModule } from '../common';
import { CommunicationModule } from '../communication';
import { ConfigsService, ProvidersModule } from '../providers';
import { UserModule } from '../user';
import { ServiceModule } from '../services';

@Module({
  imports: [
    CommunicationModule,
    UserModule,
    ProvidersModule,
    ServiceModule,
    HttpModule,
    CommonModule,
    MongooseModule.forFeature([
      { name: Member.name, schema: MemberDto },
      { name: Goal.name, schema: GoalDto },
      { name: ActionItem.name, schema: ActionItemDto },
      { name: Journal.name, schema: JournalDto },
      { name: MemberConfig.name, schema: MemberConfigDto },
      { name: Appointment.name, schema: AppointmentDto },
      { name: Recording.name, schema: MemberRecordingDto },
      { name: ArchiveMember.name, schema: ArchiveMemberDto },
      { name: ArchiveMemberConfig.name, schema: ArchiveMemberConfigDto },
      { name: ControlMember.name, schema: ControlMemberDto },
      { name: Caregiver.name, schema: CaregiverDto },
      { name: DismissedAlert.name, schema: DismissedAlertDto },
    ]),
  ],
  providers: [MemberResolver, MemberService, ConfigsService],
  controllers: [MemberController],
  exports: [MemberService, MongooseModule],
})
export class MemberModule {}
