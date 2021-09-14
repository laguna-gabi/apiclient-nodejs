import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
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
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  EventType,
  IEventUpdatedAppointment,
  NotificationType,
  UpdatedAppointmentAction,
} from '../common';
import { AppointmentBase } from './appointment.interfaces';
import { NotifyParams } from '../member';
import * as config from 'config';

@Resolver(() => Appointment)
export class AppointmentResolver extends AppointmentBase {
  constructor(
    readonly appointmentService: AppointmentService,
    readonly appointmentScheduler: AppointmentScheduler,
    readonly eventEmitter: EventEmitter2,
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

    await this.appointmentScheduler.deleteAppointmentAlert({ id: appointment.id });

    return appointment;
  }

  @Mutation(() => Notes, { nullable: true })
  async updateNotes(@Args(camelCase(UpdateNotesParams.name)) updateNotesParams: UpdateNotesParams) {
    return this.appointmentService.updateNotes(updateNotesParams);
  }

  /*************************************************************************************************
   ******************************************** Internals ******************************************
   ************************************************************************************************/

  private notifyRequestAppointment(appointment: Appointment) {
    const metadata = {
      text: {
        content: `${config
          .get('contents.appointmentRequest')
          .replace('@appLink@', appointment.link)}`,
      },
    };
    const params: NotifyParams = {
      memberId: appointment.memberId.toString(),
      userId: appointment.userId,
      type: NotificationType.text,
      metadata,
    };
    this.eventEmitter.emit(EventType.notify, params);
  }
}
