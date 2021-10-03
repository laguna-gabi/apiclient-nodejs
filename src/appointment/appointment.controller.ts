import { Body, Controller, NotFoundException, Post } from '@nestjs/common';
import { apiPrefix } from '../common';
import { Appointment, AppointmentBase, ScheduleAppointmentParams, AppointmentService } from '.';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SchedulerService } from '../scheduler';

@Controller(`${apiPrefix}/appointments`)
export class AppointmentController extends AppointmentBase {
  constructor(
    readonly appointmentService: AppointmentService,
    readonly schedulerService: SchedulerService,
    readonly eventEmitter: EventEmitter2,
  ) {
    super(appointmentService, schedulerService, eventEmitter);
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
