import { AppointmentService, ScheduleAppointmentParams, Appointment } from '.';
import {
  EventType,
  IEventUpdatedAppointment,
  NotificationType,
  NotifyParams,
  UpdatedAppointmentAction,
} from '../common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as config from 'config';
import { SchedulerService } from '../scheduler';

export class AppointmentBase {
  constructor(
    protected readonly appointmentService: AppointmentService,
    protected readonly schedulerService: SchedulerService,
    protected readonly eventEmitter: EventEmitter2,
  ) {}

  async scheduleAppointment(scheduleAppointmentParams: ScheduleAppointmentParams) {
    const appointment = await this.appointmentService.schedule(scheduleAppointmentParams);

    this.updateAppointmentExternalData(appointment);
    this.notifyAppointment(appointment);
    await this.registerAppointmentAlert(appointment);

    return appointment;
  }

  /*************************************************************************************************
   ******************************************** Helpers ********************************************
   ************************************************************************************************/

  private updateAppointmentExternalData(appointment: Appointment) {
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
  }

  private notifyAppointment(appointment: Appointment) {
    const params: NotifyParams = {
      memberId: '',
      userId: appointment.userId,
      type: NotificationType.textSms,
      metadata: {
        content: `${config
          .get('contents.appointmentUser')
          .replace('@appointment.start@', appointment.start.toLocaleString())}`,
      },
    };
    this.eventEmitter.emit(EventType.notify, params);
  }

  private async registerAppointmentAlert(appointment: Appointment) {
    await this.schedulerService.registerAppointmentAlert({
      id: appointment.id,
      memberId: appointment.memberId.toString(),
      userId: appointment.userId,
      start: appointment.start,
    });
  }
}
