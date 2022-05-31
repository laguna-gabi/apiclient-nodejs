import { Appointment, Caregiver } from '@argus/hepiusClient';
import { EntityName, Environments, ServiceName } from '@argus/pandora';
import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { MongooseModule } from '@nestjs/mongoose';
import { containers, services } from 'config';
import * as mongooseDelete from 'mongoose-delete';
import {
  CaregiverDto,
  ControlMember,
  ControlMemberDto,
  Insurance,
  InsuranceDto,
  Member,
  MemberConfig,
  MemberConfigDto,
  MemberController,
  MemberDto,
  MemberRecordingDto,
  MemberResolver,
  MemberService,
  MemberTcpController,
  Recording,
} from '.';
import { AppointmentDto } from '../appointment';
import { CommonModule, DismissedAlert, DismissedAlertDto, LoggerService } from '../common';
import { CommunicationModule } from '../communication';
import { ChangeEventFactoryProvider, useFactoryOptions } from '../db';
import { ConfigsService, ExternalConfigs, ProvidersModule } from '../providers';
import { QuestionnaireModule } from '../questionnaire';
import { ServiceModule } from '../services';
import { Todo, TodoDto, TodoModule } from '../todo';
import { UserModule } from '../user';
import { JourneyModule } from '../journey';

@Module({
  imports: [
    CommunicationModule,
    UserModule,
    ProvidersModule,
    ServiceModule,
    HttpModule,
    CommonModule,
    QuestionnaireModule,
    JourneyModule,
    TodoModule,
    MongooseModule.forFeature([
      { name: ControlMember.name, schema: ControlMemberDto },
      { name: DismissedAlert.name, schema: DismissedAlertDto },
      { name: Todo.name, schema: TodoDto },
      { name: Member.name, schema: MemberDto },
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
      {
        name: Insurance.name,
        imports: [CommonModule],
        useFactory: ChangeEventFactoryProvider(EntityName.insurance, InsuranceDto, 'memberId'),
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
            !process.env.NODE_ENV ||
            process.env.NODE_ENV === Environments.test ||
            process.env.NODE_ENV === Environments.localhost
              ? containers.poseidon
              : await configsService.getConfig(ExternalConfigs.host.poseidon);
          return {
            transport: Transport.TCP,
            options: { host, port: services.poseidon.tcpPort },
          };
        },
      },
    ]),
  ],
  providers: [MemberResolver, MemberService, ConfigsService],
  controllers: [MemberController, MemberTcpController],
  exports: [MemberService, MongooseModule],
})
export class MemberModule {}
