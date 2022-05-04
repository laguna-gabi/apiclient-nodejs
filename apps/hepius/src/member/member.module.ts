import { Caregiver } from '@argus/hepiusClient';
import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import * as mongooseDelete from 'mongoose-delete';
import {
  ActionItem,
  ActionItemDto,
  Activity,
  ActivityDto,
  Admission,
  AdmissionDto,
  AdmissionService,
  CaregiverDto,
  ControlMember,
  ControlMemberDto,
  Diagnosis,
  DiagnosisDto,
  Dietary,
  DietaryDto,
  DismissedAlert,
  DismissedAlertDto,
  ExternalAppointment,
  ExternalAppointmentDto,
  Journal,
  JournalDto,
  Journey,
  JourneyDto,
  JourneyService,
  Medication,
  MedicationDto,
  Member,
  MemberConfig,
  MemberConfigDto,
  MemberController,
  MemberDto,
  MemberRecordingDto,
  MemberResolver,
  MemberService,
  Procedure,
  ProcedureDto,
  Recording,
  WoundCare,
  WoundCareDto,
} from '.';
import { Appointment, AppointmentDto } from '../appointment';
import { CommonModule } from '../common';
import { CommunicationModule } from '../communication';
import { useFactoryOptions } from '../db';
import { ConfigsService, ProvidersModule } from '../providers';
import { QuestionnaireModule } from '../questionnaire';
import { ServiceModule } from '../services';
import { Todo, TodoDto } from '../todo';
import { UserModule } from '../user';

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
      { name: ControlMember.name, schema: ControlMemberDto },
      { name: DismissedAlert.name, schema: DismissedAlertDto },
      { name: Caregiver.name, schema: CaregiverDto },
      { name: Journal.name, schema: JournalDto },
      { name: Todo.name, schema: TodoDto },
      { name: ActionItem.name, schema: ActionItemDto },
      { name: Member.name, schema: MemberDto },
      { name: Diagnosis.name, schema: DiagnosisDto },
      { name: Procedure.name, schema: ProcedureDto },
      { name: Medication.name, schema: MedicationDto },
      { name: ExternalAppointment.name, schema: ExternalAppointmentDto },
      { name: Activity.name, schema: ActivityDto },
      { name: WoundCare.name, schema: WoundCareDto },
      { name: Dietary.name, schema: DietaryDto },
      { name: Journey.name, schema: JourneyDto },
      { name: Admission.name, schema: AdmissionDto },
    ]),
    MongooseModule.forFeatureAsync([
      {
        name: Appointment.name,
        useFactory: () => {
          return AppointmentDto.plugin(mongooseDelete, useFactoryOptions);
        },
      },
      {
        name: MemberConfig.name,
        useFactory: () => {
          return MemberConfigDto.plugin(mongooseDelete, useFactoryOptions);
        },
      },
      {
        name: Recording.name,
        useFactory: () => {
          return MemberRecordingDto.plugin(mongooseDelete, useFactoryOptions);
        },
      },
    ]),
  ],
  providers: [MemberResolver, MemberService, AdmissionService, ConfigsService, JourneyService],
  controllers: [MemberController],
  exports: [MemberService, MongooseModule],
})
export class MemberModule {}
