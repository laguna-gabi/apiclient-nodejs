import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Appointment,
  AppointmentDto,
  AppointmentResolver,
  AppointmentService,
  NotesDto,
  Notes,
} from '.';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Appointment.name, schema: AppointmentDto },
      { name: Notes.name, schema: NotesDto },
    ]),
  ],
  providers: [AppointmentResolver, AppointmentService],
})
export class AppointmentModule {}
