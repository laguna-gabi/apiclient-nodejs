import { Appointment, Caregiver } from '@argus/hepiusClient';
import { EntityName, Environments, ServiceName } from '@argus/pandora';
import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { MongooseModule } from '@nestjs/mongoose';
import { services } from 'config';
import * as mongooseDelete from 'mongoose-delete';
import {
  ActionItem,
  ActionItemDto,
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
  DietaryHelper,
  DismissedAlert,
  DismissedAlertDto,
  ExternalAppointment,
  ExternalAppointmentDto,
  Journal,
  JournalDto,
  Journey,
  JourneyDto,
  JourneyResolver,
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
} from '.';
import { AppointmentDto } from '../appointment';
import { CommonModule, LoggerService } from '../common';
import { CommunicationModule } from '../communication';
import { ChangeEventFactoryProvider, useFactoryOptions } from '../db';
import { ConfigsService, ExternalConfigs, ProvidersModule } from '../providers';
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
      { name: Journal.name, schema: JournalDto },
      { name: Todo.name, schema: TodoDto },
      { name: ActionItem.name, schema: ActionItemDto },
      { name: Member.name, schema: MemberDto },
      { name: Diagnosis.name, schema: DiagnosisDto },
      { name: Procedure.name, schema: ProcedureDto },
      { name: Medication.name, schema: MedicationDto },
      { name: ExternalAppointment.name, schema: ExternalAppointmentDto },
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
      {
        name: Caregiver.name,
        imports: [CommonModule],
        useFactory: ChangeEventFactoryProvider(EntityName.caregiver, CaregiverDto, 'memberId'),
        inject: [EventEmitter2, LoggerService],
      },
    ]),
    ClientsModule.registerAsync([
      {
        name: ServiceName.poseidon,
        inject: [ConfigsService],
        imports: [ProvidersModule],
        useFactory: async (configsService: ConfigsService) => {
          const host =
            !process.env.NODE_ENV || process.env.NODE_ENV === Environments.test
              ? `localhost`
              : await configsService.getConfig(ExternalConfigs.host.poseidon);
          return {
            transport: Transport.TCP,
            options: { host, port: services.poseidon.tcpPort },
          };
        },
      },
    ]),
  ],
  providers: [
    MemberResolver,
    MemberService,
    AdmissionService,
    ConfigsService,
    JourneyService,
    DietaryHelper,
    JourneyResolver,
  ],
  controllers: [MemberController],
  exports: [MemberService, MongooseModule],
})
export class MemberModule {}
