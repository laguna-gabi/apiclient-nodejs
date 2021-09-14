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
import { EventType, UpdatedAppointmentAction } from '../common';
import { AppointmentBase } from './appointment.interfaces';

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
    return this.appointmentService.request(requestAppointmentParams);
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

    this.eventEmitter.emit(EventType.updatedAppointment, {
      updatedAppointmentAction: UpdatedAppointmentAction.delete,
      memberId: appointment.memberId,
      userId: appointment.userId,
      key: appointment.id,
    });

    await this.appointmentScheduler.deleteAppointmentAlert({ id: appointment.id });

    return appointment;
  }

  @Mutation(() => Notes, { nullable: true })
  async updateNotes(@Args(camelCase(UpdateNotesParams.name)) updateNotesParams: UpdateNotesParams) {
    return this.appointmentService.updateNotes(updateNotesParams);
  }
}
