import { Appointment, Notes } from '@argus/hepiusClient';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  AppointmentController,
  AppointmentDto,
  AppointmentResolver,
  AppointmentService,
  NotesDto,
} from '.';
import { CommonModule, DismissedAlert, DismissedAlertDto } from '../common';
import { CommunicationModule } from '../communication';
import { OrgModule } from '../org';
import { ProvidersModule } from '../providers';
import { Recording, RecordingDto } from '../recording';

@Module({
  imports: [
    ProvidersModule,
    CommunicationModule,
    CommonModule,
    MongooseModule.forFeature([
      { name: Appointment.name, schema: AppointmentDto },
      { name: Notes.name, schema: NotesDto },
      { name: DismissedAlert.name, schema: DismissedAlertDto },
      { name: Recording.name, schema: RecordingDto },
    ]),
    OrgModule,
  ],
  providers: [AppointmentResolver, AppointmentService],
  controllers: [AppointmentController],
  exports: [AppointmentService],
})
export class AppointmentModule {}
