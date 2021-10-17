import { EventEmitter2 } from '@nestjs/event-emitter';
import * as config from 'config';
import {
  Appointment,
  AppointmentScheduler,
  AppointmentService,
  ScheduleAppointmentParams,
} from '.';
import {
  EventType,
  IEventUpdatedAppointment,
  InternalNotificationType,
  InternalNotifyParams,
  UpdatedAppointmentAction,
} from '../common';

export class AppointmentBase {
  constructor(
    protected readonly appointmentService: AppointmentService,
    protected readonly appointmentScheduler: AppointmentScheduler,
    protected readonly eventEmitter: EventEmitter2,
  ) {}

  async scheduleAppointment(scheduleAppointmentParams: ScheduleAppointmentParams) {
    const appointment = await this.appointmentService.schedule(scheduleAppointmentParams);

    this.updateAppointmentExternalData(appointment);
    this.notifyAppointment(appointment);
    await this.registerAppointmentAlert(appointment);

    this.appointmentScheduler.deleteTimeout({ id: appointment.memberId.toString() });
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
    const params: InternalNotifyParams = {
      userId: appointment.userId,
      type: InternalNotificationType.textSmsToUser,
      metadata: {
        content: `${config
          .get('contents.appointmentUser')
          .replace('@appointment.start@', appointment.start.toLocaleString())}`,
      },
    };
    this.eventEmitter.emit(EventType.internalNotify, params);
  }

  private async registerAppointmentAlert(appointment: Appointment) {
    await this.appointmentScheduler.registerAppointmentAlert({
      id: appointment.id,
      memberId: appointment.memberId.toString(),
      userId: appointment.userId,
      start: appointment.start,
    });
  }
}
