import { EventEmitter2 } from '@nestjs/event-emitter';
import { isAfter } from 'date-fns';
import {
  Appointment,
  AppointmentScheduler,
  AppointmentService,
  AppointmentStatus,
  ScheduleAppointmentParams,
} from '.';
import {
  ErrorType,
  Errors,
  EventType,
  IDispatchParams,
  IEventOnUpdatedAppointment,
  UpdatedAppointmentAction,
} from '../common';
import { ContentKey, InternalNotificationType, generateDispatchId } from '@lagunahealth/pandora';
import { v4 } from 'uuid';

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
      this.notifyScheduleAppointmentDispatches(appointment);
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

  private notifyScheduleAppointmentDispatches(appointment: Appointment) {
    const memberId = appointment.memberId.toString();
    const userId = appointment.userId.toString();
    const baseEvent = { memberId, userId, correlationId: v4() };

    let contentKey = ContentKey.appointmentScheduledUser;
    const appointmentScheduledUserEvent: IDispatchParams = {
      ...baseEvent,
      dispatchId: generateDispatchId(contentKey, userId, appointment.id),
      type: InternalNotificationType.textSmsToUser,
      metadata: { contentType: contentKey, appointmentTime: appointment.start },
    };
    this.eventEmitter.emit(EventType.notifyDispatch, appointmentScheduledUserEvent);

    contentKey = ContentKey.appointmentScheduledMember;
    const appointmentScheduledMemberEvent: IDispatchParams = {
      ...baseEvent,
      dispatchId: generateDispatchId(contentKey, memberId, appointment.id),
      type: InternalNotificationType.textSmsToMember,
      metadata: { contentType: contentKey, appointmentTime: appointment.start },
    };
    this.eventEmitter.emit(EventType.notifyDispatch, appointmentScheduledMemberEvent);
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
