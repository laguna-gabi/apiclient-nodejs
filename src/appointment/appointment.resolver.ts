import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { camelCase } from 'lodash';
import {
  Appointment,
  AppointmentService,
  EndAppointmentParams,
  RequestAppointmentParams,
  ScheduleAppointmentParams,
} from '.';

@Resolver(() => Appointment)
export class AppointmentResolver {
  constructor(private readonly appointmentService: AppointmentService) {}

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
    return this.appointmentService.schedule(scheduleAppointmentParams);
  }

  @Mutation(() => Appointment)
  async endAppointment(
    @Args(camelCase(EndAppointmentParams.name)) endAppointmentParams: EndAppointmentParams,
  ) {
    return this.appointmentService.end(endAppointmentParams);
  }

  @Mutation(() => Appointment)
  async freezeAppointment(@Args('id', { type: () => String }) id: string) {
    return this.appointmentService.freeze(id);
  }
}
