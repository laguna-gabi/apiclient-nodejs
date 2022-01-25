import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Appointment,
  AppointmentController,
  AppointmentDto,
  AppointmentResolver,
  AppointmentService,
  Notes,
  NotesDto,
} from '.';
import { CommonModule } from '../common';
import { CommunicationModule } from '../communication';
import { useFactoryOptions } from '../db';
import { OrgModule } from '../org';
import { ProvidersModule } from '../providers';
import * as mongooseDelete from 'mongoose-delete';

@Module({
  imports: [
    ProvidersModule,
    CommunicationModule,
    CommonModule,
    MongooseModule.forFeatureAsync([
      {
        name: Appointment.name,
        useFactory: () => {
          return AppointmentDto.plugin(mongooseDelete, useFactoryOptions);
        },
      },
      {
        name: Notes.name,
        useFactory: () => {
          return NotesDto.plugin(mongooseDelete, useFactoryOptions);
        },
      },
    ]),
    OrgModule,
  ],
  providers: [AppointmentResolver, AppointmentService],
  controllers: [AppointmentController],
})
export class AppointmentModule {}
