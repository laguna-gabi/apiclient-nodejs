import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Appointment,
  AppointmentDto,
  AppointmentResolver,
  AppointmentService,
} from '.';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Appointment.name, schema: AppointmentDto },
    ]),
  ],
  providers: [AppointmentResolver, AppointmentService],
})
export class AppointmentModule {}
