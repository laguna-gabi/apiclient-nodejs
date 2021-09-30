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
import { ProvidersModule } from '../providers';
import { CommunicationModule } from '../communication';
import { OrgModule } from '../org';
import { SchedulerModule } from '../scheduler';

@Module({
  imports: [
    ProvidersModule,
    CommunicationModule,
    SchedulerModule,
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
