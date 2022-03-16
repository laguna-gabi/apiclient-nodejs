import {
  AppointmentInternalKey,
  NotificationType,
  RegisterInternalKey,
  formatEx,
  generateDispatchId,
} from '@lagunahealth/pandora';
import { UseInterceptors } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { add, addDays } from 'date-fns';
import { camelCase } from 'lodash';
import {
  Appointment,
  AppointmentBase,
  AppointmentService,
  AppointmentStatus,
  EndAppointmentParams,
  Notes,
  RequestAppointmentParams,
  ScheduleAppointmentParams,
  UpdateNotesParams,
} from '.';
import {
  Client,
  ErrorType,
  Errors,
  EventType,
  IEventDeleteMember,
  IEventOnNewMember,
  IEventOnUpdatedAppointment,
  IEventOnUpdatedUserAppointments,
  IEventOnUpdatedUserCommunication,
  IInternalDispatch,
  IsValidObjectId,
  LoggerService,
  LoggingInterceptor,
  Roles,
  UpdatedAppointmentAction,
  UserRole,
  generatePath,
  getCorrelationId,
} from '../common';
import { CommunicationResolver } from '../communication';
import { Member } from '../member';
import { Bitly } from '../providers';

@UseInterceptors(LoggingInterceptor)
@Resolver(() => Appointment)
export class AppointmentResolver extends AppointmentBase {
  constructor(
    readonly appointmentService: AppointmentService,
    readonly communicationResolver: CommunicationResolver,
    readonly bitly: Bitly,
    readonly eventEmitter: EventEmitter2,
    readonly logger: LoggerService,
  ) {
    super(appointmentService, communicationResolver, bitly, eventEmitter, logger);
  }

  @Mutation(() => Appointment)
  @Roles(UserRole.coach, UserRole.nurse)
  async requestAppointment(
    @Args(camelCase(RequestAppointmentParams.name))
    requestAppointmentParams: RequestAppointmentParams,
  ) {
    const appointment = await this.appointmentService.request(requestAppointmentParams);

    this.notifyRequestAppointment(appointment);

    return appointment;
  }

  @Query(() => Appointment, { nullable: true })
  @Roles(UserRole.coach, UserRole.nurse)
  async getAppointment(
    @Args(
      'id',
      { type: () => String },
      new IsValidObjectId(Errors.get(ErrorType.appointmentIdInvalid)),
    )
    id: string,
  ) {
    return this.appointmentService.get(id);
  }

  @Mutation(() => Appointment)
  @Roles(UserRole.coach, UserRole.nurse)
  async scheduleAppointment(
    @Args(camelCase(ScheduleAppointmentParams.name))
    scheduleAppointmentParams: ScheduleAppointmentParams,
  ) {
    return super.scheduleAppointment(scheduleAppointmentParams);
  }

  @Mutation(() => Boolean)
  @Roles(UserRole.coach, UserRole.nurse)
  async deleteAppointment(
    @Client('_id') userId,
    @Args(
      'id',
      { type: () => String },
      new IsValidObjectId(Errors.get(ErrorType.appointmentIdInvalid)),
    )
    id: string,
  ) {
    await this.appointmentService.validateUpdateAppointment(id);

    const appointment = await this.appointmentService.get(id);
    await this.appointmentService.delete({ id, deletedBy: userId });
    await this.deleteAppointmentReminders(appointment);

    return true;
  }

  @Mutation(() => Appointment)
  @Roles(UserRole.coach, UserRole.nurse)
  async endAppointment(
    @Args(camelCase(EndAppointmentParams.name)) endAppointmentParams: EndAppointmentParams,
  ) {
    const appointment = await this.appointmentService.end(endAppointmentParams);

    const eventParams: IEventOnUpdatedAppointment = {
      updatedAppointmentAction: UpdatedAppointmentAction.delete,
      memberId: appointment.memberId.toString(),
      userId: appointment.userId.toString(),
      key: appointment.id,
    };
    this.eventEmitter.emit(EventType.onUpdatedAppointment, eventParams);
    await this.deleteAppointmentReminders(appointment);
    return appointment;
  }

  @Mutation(() => Notes, { nullable: true })
  @Roles(UserRole.coach, UserRole.nurse)
  async updateNotes(@Args(camelCase(UpdateNotesParams.name)) updateNotesParams: UpdateNotesParams) {
    return this.appointmentService.updateNotes(updateNotesParams);
  }

  @OnEvent(EventType.onNewMember, { async: true })
  async onNewMember(params: IEventOnNewMember) {
    this.logger.info(params, AppointmentResolver.name, this.onNewMember.name);
    const { member, user } = params;
    try {
      const requestAppointmentParams: RequestAppointmentParams = {
        memberId: member.id,
        userId: user.id,
        notBefore: add(new Date(), { hours: 2 }),
      };
      const { id: appointmentId } = await this.appointmentService.request(requestAppointmentParams);
      await this.notifyRegistration({ member, userId: user.id, appointmentId });
    } catch (ex) {
      this.logger.error(
        { memberId: member.id, userId: user.id },
        AppointmentResolver.name,
        this.onNewMember.name,
        formatEx(ex),
      );
    }
  }

  @OnEvent(EventType.onDeletedMember, { async: true })
  async deleteSchedules(params: IEventDeleteMember) {
    this.logger.info(params, AppointmentResolver.name, this.deleteSchedules.name);
    const { memberId } = params;
    try {
      const appointments = await this.appointmentService.getMemberScheduledAppointments(memberId);
      appointments.forEach((appointment) => {
        this.deleteAppointmentReminders(appointment);
      });
    } catch (ex) {
      this.logger.error(params, AppointmentResolver.name, this.deleteSchedules.name, formatEx(ex));
    }
  }

  @OnEvent(EventType.onUpdatedUserCommunication, { async: true })
  async updateUserInAppointments(params: IEventOnUpdatedUserCommunication) {
    this.logger.info(params, AppointmentResolver.name, this.updateUserInAppointments.name);
    const appointments = await this.appointmentService.getFutureAppointments(
      params.oldUserId,
      params.memberId,
    );

    if (appointments.length == 0) return;

    await Promise.all(
      appointments.map(async (appointment) => {
        try {
          switch (appointment.status) {
            case AppointmentStatus.scheduled:
              const newAppointmentParams: ScheduleAppointmentParams = {
                memberId: appointment.memberId.toString(),
                userId: params.newUserId,
                method: appointment.method,
                start: appointment.start,
                end: appointment.end,
                id: appointment.id,
              };
              await this.scheduleAppointment(newAppointmentParams);
              break;
            case AppointmentStatus.requested:
              const requestAppointmentParams: RequestAppointmentParams = {
                memberId: appointment.memberId.toString(),
                userId: params.newUserId,
                notBefore: add(new Date(), { hours: 2 }),
                id: appointment.id,
              };
              await this.requestAppointment(requestAppointmentParams);
              break;
          }
        } catch (ex) {
          this.logger.error(
            params,
            AppointmentResolver.name,
            this.updateUserInAppointments.name,
            formatEx(ex),
          );
        }
      }),
    );
    const eventParams: IEventOnUpdatedUserAppointments = { ...params, appointments };
    this.eventEmitter.emit(EventType.onUpdatedUserAppointments, eventParams);
  }

  /*************************************************************************************************
   ******************************************** Internals ******************************************
   ************************************************************************************************/

  private notifyRequestAppointment(appointment: Appointment) {
    const contentKey = AppointmentInternalKey.appointmentRequest;
    const notificationType = NotificationType.text;

    const appointmentRequest: IInternalDispatch = {
      correlationId: getCorrelationId(this.logger),
      dispatchId: generateDispatchId(contentKey, appointment.memberId.toString(), appointment.id),
      notificationType,
      recipientClientId: appointment.memberId.toString(),
      senderClientId: appointment.userId.toString(),
      contentKey,
      scheduleLink: appointment.link,
      appointmentId: appointment.id,
      path: generatePath(notificationType, contentKey, appointment.id),
    };
    this.eventEmitter.emit(EventType.notifyDispatch, appointmentRequest);
  }

  private notifyRegistration({
    member,
    userId,
    appointmentId,
  }: {
    member: Member;
    userId: string;
    appointmentId: string;
  }) {
    const baseEvent = {
      notificationType: NotificationType.textSms,
      correlationId: getCorrelationId(this.logger),
    };

    const contentKeyNewMember = RegisterInternalKey.newMember;
    const newMemberEvent: IInternalDispatch = {
      ...baseEvent,
      dispatchId: generateDispatchId(contentKeyNewMember, member.id),
      recipientClientId: member.id,
      senderClientId: userId,
      contentKey: contentKeyNewMember,
      appointmentId,
    };
    this.eventEmitter.emit(EventType.notifyDispatch, newMemberEvent);

    const contentKeyNewMemberNudge = RegisterInternalKey.newMemberNudge;
    const newMemberNudgeEvent: IInternalDispatch = {
      ...baseEvent,
      dispatchId: generateDispatchId(contentKeyNewMemberNudge, member.id),
      recipientClientId: member.id,
      senderClientId: userId,
      contentKey: contentKeyNewMemberNudge,
      appointmentId,
      triggersAt: addDays(member.createdAt, 2),
    };
    this.eventEmitter.emit(EventType.notifyDispatch, newMemberNudgeEvent);
  }

  private deleteAppointmentReminders(appointment: Appointment) {
    this.eventEmitter.emit(EventType.notifyDeleteDispatch, {
      dispatchId: generateDispatchId(
        AppointmentInternalKey.appointmentReminder,
        appointment.memberId.toString(),
        appointment.id,
      ),
    });
    this.eventEmitter.emit(EventType.notifyDeleteDispatch, {
      dispatchId: generateDispatchId(
        AppointmentInternalKey.appointmentLongReminder,
        appointment.memberId.toString(),
        appointment.id,
      ),
    });
  }
}
