import { Body, Controller, NotFoundException, Post, UseInterceptors } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  Appointment,
  AppointmentBase,
  AppointmentScheduler,
  AppointmentService,
  ScheduleAppointmentParams,
} from '.';
import { apiPrefix, LoggingInterceptor } from '../common';

@UseInterceptors(LoggingInterceptor)
@Controller(`${apiPrefix}/appointments`)
export class AppointmentController extends AppointmentBase {
  constructor(
    readonly appointmentService: AppointmentService,
    readonly appointmentScheduler: AppointmentScheduler,
    readonly eventEmitter: EventEmitter2,
  ) {
    super(appointmentService, appointmentScheduler, eventEmitter);
  }

  @Post('schedule')
  async scheduleAppointment(@Body() params: ScheduleAppointmentParams): Promise<Appointment> {
    const result = await super.scheduleAppointment(params);
    if (!result) {
      throw new NotFoundException();
    }
    return result;
  }
}
