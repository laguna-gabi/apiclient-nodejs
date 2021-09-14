import { AppointmentService } from './appointment.service';
import { ScheduleAppointmentParams } from './appointment.dto';
import { EventType, UpdatedAppointmentAction } from '../common';
import { AppointmentScheduler } from './appointment.scheduler';
import { EventEmitter2 } from '@nestjs/event-emitter';

export class AppointmentBase {
  constructor(
    protected readonly appointmentService: AppointmentService,
    protected readonly appointmentScheduler: AppointmentScheduler,
    protected readonly eventEmitter: EventEmitter2,
  ) {}

  async scheduleAppointment(scheduleAppointmentParams: ScheduleAppointmentParams) {
    const appointment = await this.appointmentService.schedule(scheduleAppointmentParams);

    this.eventEmitter.emit(EventType.updatedAppointment, {
      updatedAppointmentAction: UpdatedAppointmentAction.edit,
      memberId: appointment.memberId,
      userId: appointment.userId,
      key: appointment.id,
      value: {
        status: appointment.status,
        start: appointment.start,
      },
    });

    await this.appointmentScheduler.updateAppointmentAlert({
      id: appointment.id,
      memberId: appointment.memberId.toString(),
      userId: appointment.userId,
      start: appointment.start,
    });

    return appointment;
  }
}
