import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  ActionItem,
  ActionItemDto,
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
import { useFactoryOptions } from '../db';
import * as mongooseDelete from 'mongoose-delete';
import { QuestionnaireModule } from '../questionnaire';

@Module({
  imports: [
    CommunicationModule,
    UserModule,
    ProvidersModule,
    ServiceModule,
    HttpModule,
    CommonModule,
    QuestionnaireModule,
    MongooseModule.forFeature([
      { name: Goal.name, schema: GoalDto },
      { name: ControlMember.name, schema: ControlMemberDto },
      { name: Caregiver.name, schema: CaregiverDto },
      { name: DismissedAlert.name, schema: DismissedAlertDto },
    ]),
    MongooseModule.forFeatureAsync([
      {
        name: Appointment.name,
        useFactory: () => {
          return AppointmentDto.plugin(mongooseDelete, useFactoryOptions);
        },
      },
      {
        name: Member.name,
        useFactory: () => {
          return MemberDto.plugin(mongooseDelete, useFactoryOptions);
        },
      },
      {
        name: MemberConfig.name,
        useFactory: () => {
          return MemberConfigDto.plugin(mongooseDelete, useFactoryOptions);
        },
      },
      {
        name: ActionItem.name,
        useFactory: () => {
          return ActionItemDto.plugin(mongooseDelete, useFactoryOptions);
        },
      },
      {
        name: Recording.name,
        useFactory: () => {
          return MemberRecordingDto.plugin(mongooseDelete, useFactoryOptions);
        },
      },
      {
        name: Journal.name,
        useFactory: () => {
          return JournalDto.plugin(mongooseDelete, useFactoryOptions);
        },
      },
    ]),
  ],
  providers: [MemberResolver, MemberService, ConfigsService],
  controllers: [MemberController],
  exports: [MemberService, MongooseModule],
})
export class MemberModule {}
