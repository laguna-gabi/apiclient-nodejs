import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { camelCase } from 'lodash';
import {
  Appointment,
  AppointmentService,
  EndAppointmentParams,
  Notes,
  RequestAppointmentParams,
  ScheduleAppointmentParams,
  UpdateNotesParams,
} from '.';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import {
  EventType,
  IEventRequestAppointment,
  IEventUpdatedAppointment,
  LoggingInterceptor,
  NotificationType,
  NotifyParams,
  replaceConfigs,
  UpdatedAppointmentAction,
} from '../common';
import { AppointmentBase } from './appointment.interfaces';
import { Member } from '../member';
import { User } from '../user';
import * as config from 'config';
import { add } from 'date-fns';
import { Bitly } from '../providers';
import { OrgService } from '../org';
import { SchedulerService } from '../scheduler';
import { UseInterceptors } from '@nestjs/common';

@UseInterceptors(LoggingInterceptor)
@Resolver(() => Appointment)
export class AppointmentResolver extends AppointmentBase {
  constructor(
    readonly appointmentService: AppointmentService,
    readonly schedulerService: SchedulerService,
    readonly eventEmitter: EventEmitter2,
    readonly bitly: Bitly,
    readonly orgService: OrgService,
  ) {
    super(appointmentService, schedulerService, eventEmitter);
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

    await this.schedulerService.deleteTimeout({ id: appointment.id });

    return appointment;
  }

  @Mutation(() => Notes, { nullable: true })
  async updateNotes(@Args(camelCase(UpdateNotesParams.name)) updateNotesParams: UpdateNotesParams) {
    return this.appointmentService.updateNotes(updateNotesParams);
  }

  @OnEvent(EventType.requestAppointment, { async: true })
  async handleRequestAppointment(params: IEventRequestAppointment) {
    const { member, user } = params;
    const requestAppointmentParams: RequestAppointmentParams = {
      memberId: member.id,
      userId: user.id,
      notBefore: add(new Date(), { hours: 2 }),
    };
    const { id } = await this.appointmentService.request(requestAppointmentParams);
    const url = await this.bitly.shortenLink(`${config.get('hosts.webApp')}/download/${id}`);
    await this.notifyRegistration({ member, user, url });
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
    const params: NotifyParams = {
      memberId: appointment.memberId.toString(),
      userId: appointment.userId,
      type: NotificationType.text,
      metadata,
    };
    this.eventEmitter.emit(EventType.notify, params);
  }

  private async notifyRegistration({
    member,
    user,
    url,
  }: {
    member: Member;
    user: User;
    url: string;
  }) {
    const org = await this.orgService.get(member.org.toString());
    const metadata = {
      content: replaceConfigs({
        content: org
          ? config.get('contents.downloadPage')
          : config.get('contents.downloadPageWithoutOrg'),
        member,
        user,
      })
        .replace('@org.name@', org?.name)
        .replace('@downloadLink@', `\n${url}`),
    };
    const params: NotifyParams = {
      memberId: member.id,
      userId: user.id,
      type: NotificationType.textSms,
      metadata,
    };
    this.eventEmitter.emit(EventType.notify, params);
  }
}
