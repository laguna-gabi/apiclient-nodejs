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
import { OrgModule } from '../org';
import { ProvidersModule } from '../providers';
import { InternalSchedulerModule } from '../scheduler';

@Module({
  imports: [
    InternalSchedulerModule,
    ProvidersModule,
    CommunicationModule,
    CommonModule,
    MongooseModule.forFeature([
      { name: Appointment.name, schema: AppointmentDto },
      { name: Notes.name, schema: NotesDto },
    ]),
    OrgModule,
  ],
  providers: [AppointmentResolver, AppointmentService],
  controllers: [AppointmentController],
})
export class AppointmentModule {}
