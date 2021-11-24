import { EventEmitter2 } from '@nestjs/event-emitter';
import { format, isAfter } from 'date-fns';
import {
  Appointment,
  AppointmentScheduler,
  AppointmentService,
  AppointmentStatus,
  ScheduleAppointmentParams,
} from '.';
import {
  ContentKey,
  ErrorType,
  Errors,
  EventType,
  IEventOnUpdatedAppointment,
  InternalNotifyParams,
  UpdatedAppointmentAction,
  scheduleAppointmentDateFormat,
} from '../common';
import { InternalNotificationType } from '@lagunahealth/pandora';

export class AppointmentBase {
  constructor(
    protected readonly appointmentService: AppointmentService,
    protected readonly appointmentScheduler: AppointmentScheduler,
    protected readonly eventEmitter: EventEmitter2,
  ) {}

  async scheduleAppointment(scheduleAppointmentParams: ScheduleAppointmentParams) {
    await this.validateUpdateScheduleAppointment(scheduleAppointmentParams.id);
    const appointment = await this.appointmentService.schedule(scheduleAppointmentParams);

    this.updateAppointmentExternalData(appointment);

    if (isAfter(appointment.start, new Date())) {
      this.notifyUserAppointment(appointment);
      this.notifyMemberAppointment(appointment);
      await this.registerAppointmentAlert(appointment);
    }

    this.appointmentScheduler.deleteTimeout({ id: appointment.memberId.toString() });
    return appointment;
  }

  /*************************************************************************************************
   ******************************************** Helpers ********************************************
   ************************************************************************************************/

  private updateAppointmentExternalData(appointment: Appointment) {
    const eventParams: IEventOnUpdatedAppointment = {
      updatedAppointmentAction: UpdatedAppointmentAction.edit,
      memberId: appointment.memberId.toString(),
      userId: appointment.userId.toString(),
      key: appointment.id,
      value: {
        status: appointment.status,
        start: appointment.start,
      },
    };
    this.eventEmitter.emit(EventType.onUpdatedAppointment, eventParams);
  }

  private notifyUserAppointment(appointment: Appointment) {
    const params: InternalNotifyParams = {
      memberId: appointment.memberId.toString(),
      userId: appointment.userId.toString(),
      type: InternalNotificationType.textSmsToUser,
      metadata: {
        contentType: ContentKey.appointmentScheduledUser,
        extraData: {
          appointmentTime: `${format(
            new Date(appointment.start.toUTCString()),
            scheduleAppointmentDateFormat,
          )} (UTC)`,
        },
      },
    };
    this.eventEmitter.emit(EventType.notifyInternal, params);
  }

  private notifyMemberAppointment(appointment: Appointment) {
    const params: InternalNotifyParams = {
      memberId: appointment.memberId.toString(),
      userId: appointment.userId.toString(),
      type: InternalNotificationType.textSmsToMember,
      metadata: {
        contentType: ContentKey.appointmentScheduledMember,
        appointmentTime: appointment.start,
      },
    };
    this.eventEmitter.emit(EventType.notifyInternal, params);
  }

  private async registerAppointmentAlert(appointment: Appointment) {
    await this.appointmentScheduler.registerAppointmentAlert({
      id: appointment.id,
      memberId: appointment.memberId.toString(),
      userId: appointment.userId.toString(),
      start: appointment.start,
    });
  }

  private async validateUpdateScheduleAppointment(id: string) {
    if (id) {
      const existingAppointment = await this.appointmentService.get(id);
      if (existingAppointment?.status === AppointmentStatus.done) {
        throw new Error(Errors.get(ErrorType.appointmentCanNotBeUpdated));
      }
    }
  }
}
