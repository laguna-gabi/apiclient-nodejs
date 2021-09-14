import { AppointmentService, ScheduleAppointmentParams, AppointmentScheduler } from '.';
import { EventType, IEventUpdatedAppointment, UpdatedAppointmentAction } from '../common';
import { EventEmitter2 } from '@nestjs/event-emitter';

export class AppointmentBase {
  constructor(
    protected readonly appointmentService: AppointmentService,
    protected readonly appointmentScheduler: AppointmentScheduler,
    protected readonly eventEmitter: EventEmitter2,
  ) {}

  async scheduleAppointment(scheduleAppointmentParams: ScheduleAppointmentParams) {
    const appointment = await this.appointmentService.schedule(scheduleAppointmentParams);

    const eventParams: IEventUpdatedAppointment = {
      updatedAppointmentAction: UpdatedAppointmentAction.edit,
      memberId: appointment.memberId.toString(),
      userId: appointment.userId,
      key: appointment.id,
      value: {
        status: appointment.status,
        start: appointment.start,
      },
    };
    this.eventEmitter.emit(EventType.updatedAppointment, eventParams);

    await this.appointmentScheduler.updateAppointmentAlert({
      id: appointment.id,
      memberId: appointment.memberId.toString(),
      userId: appointment.userId,
      start: appointment.start,
    });

    return appointment;
  }
}
