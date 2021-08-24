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

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Appointment.name, schema: AppointmentDto },
      { name: Notes.name, schema: NotesDto },
    ]),
  ],
  providers: [AppointmentResolver, AppointmentService],
  controllers: [AppointmentController],
})
export class AppointmentModule {}
