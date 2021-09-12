import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { camelCase } from 'lodash';
import {
  Appointment,
  AppointmentService,
  EndAppointmentParams,
  RequestAppointmentParams,
  ScheduleAppointmentParams,
  Notes,
  UpdateNotesParams,
} from '.';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { UpdatedAppointmentAction, EventType } from '../common';

@Resolver(() => Appointment)
export class AppointmentResolver {
  constructor(
    private readonly appointmentService: AppointmentService,
    private eventEmitter: EventEmitter2,
  ) {}

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
    const appointment = await this.appointmentService.schedule(scheduleAppointmentParams);

    this.eventEmitter.emit(EventType.updatedAppointment, {
      updatedAppointmentAction: UpdatedAppointmentAction.edit,
      memberId: appointment.memberId,
      userId: appointment.userId,
      key: appointment.id,
      value: {
        status: appointment.status,
        start: appointment.start,
      },
    });

    return appointment;
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

    return appointment;
  }

  @Mutation(() => Notes, { nullable: true })
  async updateNotes(@Args(camelCase(UpdateNotesParams.name)) updateNotesParams: UpdateNotesParams) {
    return this.appointmentService.updateNotes(updateNotesParams);
  }
}
