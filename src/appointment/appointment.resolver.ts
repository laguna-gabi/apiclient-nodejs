import { UseInterceptors } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import * as config from 'config';
import { add } from 'date-fns';
import { camelCase } from 'lodash';
import {
  Appointment,
  AppointmentScheduler,
  AppointmentService,
  EndAppointmentParams,
  Notes,
  RequestAppointmentParams,
  ScheduleAppointmentParams,
  UpdateNotesParams,
} from '.';
import {
  EventType,
  IEventRequestAppointment,
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
import { AppointmentBase } from './appointment.interfaces';

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

    await this.appointmentScheduler.deleteTimeout({
      id: appointment.id + ReminderType.appointmentReminder,
    });
    await this.appointmentScheduler.deleteTimeout({
      id: appointment.id + ReminderType.appointmentLongReminder,
    });

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

  /*************************************************************************************************
   ******************************************** Internals ******************************************
   ************************************************************************************************/

  private notifyRequestAppointment(appointment: Appointment) {
    const metadata = {
      content: `${config
        .get('contents.appointmentRequest')
        .replace('@appLink@', appointment.link)}`,
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
      `${config.get('hosts.webApp')}/download/${appointmentId}`,
    );
    const org = await this.orgService.get(member.org.toString());
    const metadata = {
      content: `${(org
        ? config.get('contents.downloadPage')
        : config.get('contents.downloadPageWithoutOrg')
      )
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
