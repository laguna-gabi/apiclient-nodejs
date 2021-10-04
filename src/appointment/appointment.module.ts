import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Appointment,
  AppointmentController,
  AppointmentDto,
  AppointmentResolver,
  AppointmentScheduler,
  AppointmentService,
  Notes,
  NotesDto,
} from '.';
import { ProvidersModule } from '../providers';
import { CommunicationModule } from '../communication';
import { OrgModule } from '../org';

@Module({
  imports: [
    ProvidersModule,
    CommunicationModule,
    MongooseModule.forFeature([
      { name: Appointment.name, schema: AppointmentDto },
      { name: Notes.name, schema: NotesDto },
    ]),
    OrgModule,
  ],
  providers: [AppointmentResolver, AppointmentService, AppointmentScheduler],
  controllers: [AppointmentController],
})
export class AppointmentModule {}
