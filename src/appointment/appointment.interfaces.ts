import { InternalKey, NotificationType, generateDispatchId } from '@lagunahealth/pandora';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { scheduler } from 'config';
import { addDays, addMinutes, isBefore, subDays, subMinutes } from 'date-fns';
import { Appointment, AppointmentService, AppointmentStatus, ScheduleAppointmentParams } from '.';
import {
  ErrorType,
  Errors,
  EventType,
  IEventOnUpdatedAppointment,
  IInternalDispatch,
  LoggerService,
  UpdatedAppointmentAction,
  getCorrelationId,
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
      dispatchId: generateDispatchId(InternalKey.newMemberNudge, memberId),
    });
    this.eventEmitter.emit(EventType.notifyDeleteDispatch, {
      dispatchId: generateDispatchId(InternalKey.newRegisteredMember, memberId),
    });
    this.eventEmitter.emit(EventType.notifyDeleteDispatch, {
      dispatchId: generateDispatchId(InternalKey.newRegisteredMemberNudge, memberId),
    });
  }

  private async notifyScheduleAppointmentDispatches(appointment: Appointment) {
    this.logger.info(
      appointment,
      AppointmentBase.name,
      this.notifyScheduleAppointmentDispatches.name,
    );
    if (isBefore(appointment.start, new Date())) {
      return;
    }

    const memberId = appointment.memberId.toString();
    const userId = appointment.userId.toString();
    const correlationId = getCorrelationId(this.logger);

    const contentKeyUser = InternalKey.appointmentScheduledUser;
    const appointmentScheduledUserEvent: IInternalDispatch = {
      correlationId,
      dispatchId: generateDispatchId(contentKeyUser, userId, appointment.id),
      notificationType: NotificationType.textSms,
      recipientClientId: userId,
      senderClientId: memberId,
      contentKey: contentKeyUser,
      appointmentTime: appointment.start,
    };
    this.eventEmitter.emit(EventType.notifyDispatch, appointmentScheduledUserEvent);

    const contentKey = InternalKey.appointmentScheduledMember;
    const appointmentScheduledMemberEvent: IInternalDispatch = {
      correlationId,
      dispatchId: generateDispatchId(contentKey, memberId, appointment.id),
      notificationType: NotificationType.textSms,
      recipientClientId: memberId,
      senderClientId: userId,
      contentKey,
      appointmentTime: appointment.start,
    };
    this.eventEmitter.emit(EventType.notifyDispatch, appointmentScheduledMemberEvent);

    if (appointment.start >= addMinutes(new Date(), scheduler.alertBeforeInMin)) {
      const contentKey = InternalKey.appointmentReminder;
      const appointmentReminderShortEvent: IInternalDispatch = {
        correlationId,
        dispatchId: generateDispatchId(contentKey, memberId, appointment.id),
        notificationType: NotificationType.text,
        recipientClientId: memberId,
        senderClientId: userId,
        contentKey,
        appointmentTime: appointment.start,
        triggersAt: subMinutes(appointment.start, scheduler.alertBeforeInMin),
        chatLink: await this.getChatLink(memberId, userId),
      };
      this.eventEmitter.emit(EventType.notifyDispatch, appointmentReminderShortEvent);
    }
    if (appointment.start >= addDays(new Date(), 1)) {
      const contentKey = InternalKey.appointmentLongReminder;
      const appointmentReminderLongEvent: IInternalDispatch = {
        correlationId,
        dispatchId: generateDispatchId(contentKey, memberId, appointment.id),
        notificationType: NotificationType.text,
        recipientClientId: memberId,
        senderClientId: userId,
        contentKey,
        appointmentTime: appointment.start,
        triggersAt: subDays(appointment.start, 1),
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
      this.logger.warn({ memberId, userId }, AppointmentBase.name, this.getChatLink.name, {
        message: Errors.get(ErrorType.communicationMemberUserNotFound),
      });
    } else {
      return this.bitly.shortenLink(communication.chat.memberLink);
    }
  }
}
