import {
  AppointmentService,
  ScheduleAppointmentParams,
  AppointmentScheduler,
  Appointment,
} from '.';
import {
  EventType,
  IEventUpdatedAppointment,
  NotificationType,
  UpdatedAppointmentAction,
} from '../common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NotifyParams } from '../member';
import * as config from 'config';

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
    await this.appointmentScheduler.registerAppointmentAlert({
      id: appointment.id,
      memberId: appointment.memberId.toString(),
      userId: appointment.userId,
      start: appointment.start,
    });
  }
}
