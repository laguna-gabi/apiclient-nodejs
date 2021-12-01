import { UseInterceptors } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import * as config from 'config';
import { add } from 'date-fns';
import { camelCase } from 'lodash';
import {
  Appointment,
  AppointmentBase,
  AppointmentScheduler,
  AppointmentService,
  AppointmentStatus,
  EndAppointmentParams,
  Notes,
  RequestAppointmentParams,
  ScheduleAppointmentParams,
  UpdateNotesParams,
} from '.';
import {
  EventType,
  IEventMember,
  IEventOnNewMember,
  IEventOnUpdatedAppointment,
  IEventOnUpdatedUserAppointments,
  IEventOnUpdatedUserCommunication,
  InternalNotifyParams,
  Logger,
  LoggingInterceptor,
  ReminderType,
  Roles,
  UpdatedAppointmentAction,
  UserRole,
} from '../common';
import { Member } from '../member';
import { OrgService } from '../org';
import { Bitly } from '../providers';
import { User } from '../user';
import { ContentKey, InternalNotificationType } from '@lagunahealth/pandora';

@UseInterceptors(LoggingInterceptor)
@Resolver(() => Appointment)
export class AppointmentResolver extends AppointmentBase {
  constructor(
    readonly appointmentService: AppointmentService,
    readonly appointmentScheduler: AppointmentScheduler,
    readonly eventEmitter: EventEmitter2,
    readonly bitly: Bitly,
    readonly orgService: OrgService,
    readonly logger: Logger,
  ) {
    super(appointmentService, appointmentScheduler, eventEmitter);
  }

  @Mutation(() => Appointment)
  @Roles(UserRole.coach)
  async requestAppointment(
    @Args(camelCase(RequestAppointmentParams.name))
    requestAppointmentParams: RequestAppointmentParams,
  ) {
    const appointment = await this.appointmentService.request(requestAppointmentParams);

    this.notifyRequestAppointment(appointment);

    return appointment;
  }

  @Query(() => Appointment, { nullable: true })
  @Roles(UserRole.coach)
  async getAppointment(@Args('id', { type: () => String }) id: string) {
    return this.appointmentService.get(id);
  }

  @Mutation(() => Appointment)
  @Roles(UserRole.coach)
  async scheduleAppointment(
    @Args(camelCase(ScheduleAppointmentParams.name))
    scheduleAppointmentParams: ScheduleAppointmentParams,
  ) {
    return super.scheduleAppointment(scheduleAppointmentParams);
  }

  @Mutation(() => Appointment)
  @Roles(UserRole.coach)
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
    await this.appointmentScheduler.unRegisterAppointmentAlert(appointment.id);
    return appointment;
  }

  @Mutation(() => Notes, { nullable: true })
  @Roles(UserRole.coach)
  async updateNotes(@Args(camelCase(UpdateNotesParams.name)) updateNotesParams: UpdateNotesParams) {
    return this.appointmentService.updateNotes(updateNotesParams);
  }

  @OnEvent(EventType.onNewMember, { async: true })
  async onNewMember(params: IEventOnNewMember) {
    const { member, user } = params;
    try {
      const requestAppointmentParams: RequestAppointmentParams = {
        memberId: member.id,
        userId: user.id,
        notBefore: add(new Date(), { hours: 2 }),
      };
      const { id: appointmentId } = await this.appointmentService.request(requestAppointmentParams);
      await this.notifyRegistration({ member, user, appointmentId });
      await this.appointmentScheduler.registerNewMemberNudge({ member, user, appointmentId });
    } catch (ex) {
      this.logger.error(
        { memberId: member.id, userId: user.id },
        AppointmentResolver.name,
        this.onNewMember.name,
        ex,
      );
    }
  }

  @OnEvent(EventType.onDeletedMember, { async: true })
  async deleteSchedules(params: IEventMember) {
    const { memberId } = params;
    try {
      const appointments = await this.appointmentService.getMemberScheduledAppointments(memberId);
      appointments.forEach((appointment) => {
        this.appointmentScheduler.deleteTimeout({
          id: appointment.id + ReminderType.appointmentReminder,
        });
        this.appointmentScheduler.deleteTimeout({
          id: appointment.id + ReminderType.appointmentLongReminder,
        });
      });
    } catch (ex) {
      this.logger.error(params, AppointmentResolver.name, this.deleteSchedules.name, ex);
    }
  }

  @OnEvent(EventType.onUpdatedUserCommunication, { async: true })
  async updateUserInAppointments(params: IEventOnUpdatedUserCommunication) {
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
            ex,
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
    const params: InternalNotifyParams = {
      memberId: appointment.memberId.toString(),
      userId: appointment.userId.toString(),
      type: InternalNotificationType.textToMember,
      metadata: {
        contentType: ContentKey.appointmentRequest,
        scheduleLink: appointment.link,
        path: `connect/${appointment.id}`,
      },
    };
    this.eventEmitter.emit(EventType.notifyInternal, params);
  }

  private async notifyRegistration({
    member,
    user,
    appointmentId,
  }: {
    member: Member;
    user: User;
    appointmentId: string;
  }) {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const org = await this.orgService.get(member.org._id.toString());
    const downloadLink = await this.bitly.shortenLink(
      `${config.get('hosts.app')}/download/${appointmentId}`,
    );
    const params: InternalNotifyParams = {
      memberId: member.id,
      userId: user.id,
      type: InternalNotificationType.textSmsToMember,
      metadata: {
        contentType: ContentKey.newMember,
        extraData: { org, downloadLink },
      },
    };
    this.eventEmitter.emit(EventType.notifyInternal, params);
  }
}
