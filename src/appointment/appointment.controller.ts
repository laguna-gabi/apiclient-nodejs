import { Body, Controller, NotFoundException, Post } from '@nestjs/common';
import { apiPrefix } from '../common';
import {
  Appointment,
  AppointmentScheduler,
  AppointmentBase,
  ScheduleAppointmentParams,
  AppointmentService,
} from '.';
import { EventEmitter2 } from '@nestjs/event-emitter';

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
