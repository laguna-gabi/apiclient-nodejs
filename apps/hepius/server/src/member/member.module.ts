import { Appointment } from '@argus/hepiusClient';
import { EntityName } from '@argus/pandora';
import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MongooseModule } from '@nestjs/mongoose';
import * as mongooseDelete from 'mongoose-delete';
import {
  ControlMember,
  ControlMemberDto,
  Insurance,
  InsuranceDto,
  Member,
  MemberConfig,
  MemberConfigDto,
  MemberController,
  MemberDto,
  MemberResolver,
  MemberService,
} from '.';
import { AppointmentDto, AppointmentModule } from '../appointment';
import { CommonModule, DismissedAlert, DismissedAlertDto, LoggerService } from '../common';
import { CommunicationModule } from '../communication';
import { ChangeEventFactoryProvider, useFactoryOptions } from '../db';
import { JourneyModule } from '../journey';
import { ConfigsService, ProvidersModule } from '../providers';
import { QuestionnaireModule } from '../questionnaire';
import { ServiceModule } from '../services';
import { Todo, TodoDto, TodoModule } from '../todo';
import { UserModule } from '../user';
import { OrgModule } from '../org';

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
    AppointmentModule,
    OrgModule,
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
        name: Insurance.name,
        imports: [CommonModule],
        useFactory: ChangeEventFactoryProvider(EntityName.insurance, InsuranceDto, 'memberId'),
        inject: [EventEmitter2, LoggerService],
      },
    ]),
  ],
  providers: [MemberResolver, MemberService, ConfigsService],
  controllers: [MemberController],
  exports: [MemberService, MongooseModule],
})
export class MemberModule {}
