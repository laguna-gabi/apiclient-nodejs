import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { camelCase } from 'lodash';
import {
  Appointment,
  AppointmentService,
  CreateAppointmentParams,
  ScheduleAppointmentParams,
  NoShowParams,
} from '.';

@Resolver(() => Appointment)
export class AppointmentResolver {
  constructor(private readonly appointmentService: AppointmentService) {}

  @Mutation(() => Appointment)
  async createAppointment(
    @Args(camelCase(CreateAppointmentParams.name))
    createAppointmentParams: CreateAppointmentParams,
  ) {
    return this.appointmentService.insert(createAppointmentParams);
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
  async endAppointment(@Args('id', { type: () => String }) id: string) {
    return this.appointmentService.end(id);
  }

  @Mutation(() => Appointment)
  async freezeAppointment(@Args('id', { type: () => String }) id: string) {
    return this.appointmentService.freeze(id);
  }

  @Mutation(() => Appointment)
  noShowAppointment(
    @Args(camelCase(NoShowParams.name))
    noShowParams: NoShowParams,
  ) {
    return this.appointmentService.show(noShowParams);
  }
}
