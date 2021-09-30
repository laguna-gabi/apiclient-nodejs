import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { NotifyParams, NotifyParamsDto } from '../common';
import { SchedulerService } from '.';
import { Appointment, AppointmentDto } from '../appointment';
import { CommunicationModule } from '../communication';
import { ProvidersModule } from '../providers';

@Module({
  imports: [
    CommunicationModule,
    ProvidersModule,
    MongooseModule.forFeature([
      { name: NotifyParams.name, schema: NotifyParamsDto },
      { name: Appointment.name, schema: AppointmentDto },
    ]),
  ],
  providers: [SchedulerService],
  exports: [SchedulerService],
})
export class SchedulerModule {}
