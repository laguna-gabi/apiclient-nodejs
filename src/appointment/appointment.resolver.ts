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
  IEventDeleteSchedules,
  IEventRequestAppointment,
  IEventUpdateUserInAppointments,
  IEventUpdatedAppointment,
  InternalNotificationType,
  InternalNotifyParams,
  Logger,
  LoggingInterceptor,
  ReminderType,
  UpdatedAppointmentAction,
} from '../common';
import { Member } from '../member';
import { OrgService } from '../org';
import { Bitly } from '../providers';
import { User } from '../user';

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
  async requestAppointment(
    @Args(camelCase(RequestAppointmentParams.name))
    requestAppointmentParams: RequestAppointmentParams,
  ) {
    const appointment = await this.appointmentService.request(requestAppointmentParams);

    this.notifyRequestAppointment(appointment);

    return appointment;
  }

  @Query(() => Appointment, { nullable: true })
  async getAppointment(@Args('id', { type: () => String }) id: string) {
    return this.appointmentService.get(id);
  }

  @Mutation(() => Appointment)
  async scheduleAppointment(
    @Args(camelCase(ScheduleAppointmentParams.name))
    scheduleAppointmentParams: ScheduleAppointmentParams,
  ) {
    return super.scheduleAppointment(scheduleAppointmentParams);
  }

  @Mutation(() => Appointment)
  async endAppointment(
    @Args(camelCase(EndAppointmentParams.name)) endAppointmentParams: EndAppointmentParams,
  ) {
    const appointment = await this.appointmentService.end(endAppointmentParams);

    const eventParams: IEventUpdatedAppointment = {
      updatedAppointmentAction: UpdatedAppointmentAction.delete,
      memberId: appointment.memberId.toString(),
      userId: appointment.userId,
      key: appointment.id,
    };
    this.eventEmitter.emit(EventType.updatedAppointment, eventParams);
    await this.appointmentScheduler.unRegisterAppointmentAlert(appointment.id);
    return appointment;
  }

  @Mutation(() => Notes, { nullable: true })
  async updateNotes(@Args(camelCase(UpdateNotesParams.name)) updateNotesParams: UpdateNotesParams) {
    return this.appointmentService.updateNotes(updateNotesParams);
  }

  @OnEvent(EventType.requestAppointment, { async: true })
  async handleRequestAppointment(params: IEventRequestAppointment) {
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
        this.handleRequestAppointment.name,
        ex,
      );
    }
  }

  @OnEvent(EventType.deleteSchedules, { async: true })
  async deleteSchedules(params: IEventDeleteSchedules) {
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

  @OnEvent(EventType.updateUserInAppointments, { async: true })
  async updateUserInAppointments(params: IEventUpdateUserInAppointments) {
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
    this.eventEmitter.emit(EventType.updateAppointmentsInUser, { ...params, appointments });
  }

  /*************************************************************************************************
   ******************************************** Internals ******************************************
   ************************************************************************************************/

  private notifyRequestAppointment(appointment: Appointment) {
    const metadata = {
      content: `${config
        .get('contents.appointmentRequest')
        .replace('@downloadLink@', appointment.link)}`,
    };
    const params: InternalNotifyParams = {
      memberId: appointment.memberId.toString(),
      userId: appointment.userId,
      type: InternalNotificationType.textToMember,
      metadata,
    };
    this.eventEmitter.emit(EventType.internalNotify, params);
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
    const url = await this.bitly.shortenLink(
      `${config.get('hosts.app')}/download/${appointmentId}`,
    );
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const org = await this.orgService.get(member.org._id.toString());
    const metadata = {
      content: `${config
        .get('contents.newMember')
        .replace('@org.name@', org?.name)
        .replace('@downloadLink@', `\n${url}`)}`,
    };
    const params: InternalNotifyParams = {
      memberId: member.id,
      userId: user.id,
      type: InternalNotificationType.textSmsToMember,
      metadata,
    };
    this.eventEmitter.emit(EventType.internalNotify, params);
  }
}
