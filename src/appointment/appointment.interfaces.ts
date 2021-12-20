import { ContentKey, InternalNotificationType, generateDispatchId } from '@lagunahealth/pandora';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { scheduler } from 'config';
import { addDays, addMinutes, isBefore, subDays, subMinutes } from 'date-fns';
import { v4 } from 'uuid';
import { Appointment, AppointmentService, AppointmentStatus, ScheduleAppointmentParams } from '.';
import {
  ErrorType,
  Errors,
  EventType,
  IDispatchParams,
  IEventOnUpdatedAppointment,
  LoggerService,
  UpdatedAppointmentAction,
} from '../common';
import { CommunicationResolver } from '../communication';
import { Bitly } from '../providers';

export class AppointmentBase {
  constructor(
    protected readonly appointmentService: AppointmentService,
    protected readonly communicationResolver: CommunicationResolver,
    protected readonly bitly: Bitly,
    protected readonly eventEmitter: EventEmitter2,
    protected readonly logger: LoggerService,
  ) {}

  async scheduleAppointment(scheduleAppointmentParams: ScheduleAppointmentParams) {
    await this.validateUpdateScheduleAppointment(scheduleAppointmentParams.id);
    const appointment = await this.appointmentService.schedule(scheduleAppointmentParams);

    this.updateAppointmentExternalData(appointment);
    await this.deleteDispatchesOnScheduleAppointment(appointment.memberId.toString());
    await this.notifyScheduleAppointmentDispatches(appointment);

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

  private async deleteDispatchesOnScheduleAppointment(memberId: string) {
    this.eventEmitter.emit(EventType.notifyDeleteDispatch, {
      dispatchId: generateDispatchId(ContentKey.newMemberNudge, memberId),
    });
    this.eventEmitter.emit(EventType.notifyDeleteDispatch, {
      dispatchId: generateDispatchId(ContentKey.newRegisteredMember, memberId),
    });
    this.eventEmitter.emit(EventType.notifyDeleteDispatch, {
      dispatchId: generateDispatchId(ContentKey.newRegisteredMemberNudge, memberId),
    });
  }

  private async notifyScheduleAppointmentDispatches(appointment: Appointment) {
    this.logger.debug(
      appointment,
      AppointmentBase.name,
      this.notifyScheduleAppointmentDispatches.name,
    );
    const memberId = appointment.memberId.toString();
    const userId = appointment.userId.toString();
    const baseEvent = { memberId, userId, correlationId: v4() };

    if (isBefore(appointment.start, new Date())) {
      return;
    }

    const contentKey1 = ContentKey.appointmentScheduledUser;
    const appointmentScheduledUserEvent: IDispatchParams = {
      ...baseEvent,
      dispatchId: generateDispatchId(contentKey1, userId, appointment.id),
      type: InternalNotificationType.textSmsToUser,
      metadata: { contentType: contentKey1, appointmentTime: appointment.start },
    };
    this.eventEmitter.emit(EventType.notifyDispatch, appointmentScheduledUserEvent);

    const contentKey2 = ContentKey.appointmentScheduledMember;
    const appointmentScheduledMemberEvent: IDispatchParams = {
      ...baseEvent,
      dispatchId: generateDispatchId(contentKey2, memberId, appointment.id),
      type: InternalNotificationType.textSmsToMember,
      metadata: { contentType: contentKey2, appointmentTime: appointment.start },
    };
    this.eventEmitter.emit(EventType.notifyDispatch, appointmentScheduledMemberEvent);

    if (appointment.start >= addMinutes(new Date(), scheduler.alertBeforeInMin)) {
      const contentKey3 = ContentKey.appointmentReminder;
      const appointmentReminderShortEvent: IDispatchParams = {
        ...baseEvent,
        dispatchId: generateDispatchId(contentKey3, memberId, appointment.id),
        type: InternalNotificationType.textToMember,
        metadata: {
          contentType: contentKey3,
          appointmentTime: appointment.start,
          triggersAt: subMinutes(appointment.start, scheduler.alertBeforeInMin),
          chatLink: await this.getChatLink(memberId, userId),
        },
      };
      this.eventEmitter.emit(EventType.notifyDispatch, appointmentReminderShortEvent);
    }
    if (appointment.start >= addDays(new Date(), 1)) {
      const contentKey4 = ContentKey.appointmentLongReminder;
      const appointmentReminderLongEvent: IDispatchParams = {
        ...baseEvent,
        dispatchId: generateDispatchId(contentKey4, memberId, appointment.id),
        type: InternalNotificationType.textToMember,
        metadata: {
          contentType: contentKey4,
          appointmentTime: appointment.start,
          triggersAt: subDays(appointment.start, 1),
        },
      };
      this.eventEmitter.emit(EventType.notifyDispatch, appointmentReminderLongEvent);
    }
  }

  private async validateUpdateScheduleAppointment(id: string) {
    if (id) {
      const existingAppointment = await this.appointmentService.get(id);
      if (existingAppointment?.status === AppointmentStatus.done) {
        throw new Error(Errors.get(ErrorType.appointmentCanNotBeUpdated));
      }
    }
  }

  private async getChatLink(memberId: string, userId: string) {
    const communication = await this.communicationResolver.getCommunication({ memberId, userId });
    if (!communication) {
      this.logger.warn(
        { memberId, userId },
        AppointmentBase.name,
        this.getChatLink.name,
        Errors.get(ErrorType.communicationMemberUserNotFound),
      );
    } else {
      return this.bitly.shortenLink(communication.chat.memberLink);
    }
  }
}
