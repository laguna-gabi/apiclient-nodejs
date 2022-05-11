import { Mutations } from '.';
import {
  generateAppointmentLink,
  generateEndAppointmentParams,
  generateRequestAppointmentParams,
  generateScheduleAppointmentParams,
} from '..';
import { Member } from '../../src/member';
import { Appointment, AppointmentStatus } from '@argus/hepiusClient';

export class AppointmentsIntegrationActions {
  constructor(private readonly mutations: Mutations, private readonly defaultUserRequestHeaders) {}

  requestAppointment = async ({
    userId,
    member,
    requestHeaders,
  }: {
    userId?: string;
    member: Member;
    requestHeaders?;
  }): Promise<Appointment> => {
    const appointmentParams = generateRequestAppointmentParams({
      memberId: member.id,
      userId: userId || member.primaryUserId.toString(),
    });
    const appointmentResult = await this.mutations.requestAppointment({
      appointmentParams,
      requestHeaders,
    });

    expect(appointmentResult.userId).toEqual(appointmentParams.userId);
    expect(appointmentResult.memberId).toEqual(appointmentParams.memberId);
    expect(new Date(appointmentResult.notBefore)).toEqual(new Date(appointmentParams.notBefore));
    expect(appointmentResult.status).toEqual(AppointmentStatus.requested);
    expect(appointmentResult.link).toEqual(generateAppointmentLink(appointmentResult.id));

    return appointmentResult;
  };

  scheduleAppointment = async ({
    userId,
    member,
  }: {
    userId?: string;
    member: Member;
  }): Promise<Appointment> => {
    const scheduleAppointment = generateScheduleAppointmentParams({
      memberId: member.id,
      userId: userId || member.primaryUserId.toString(),
    });
    const appointmentResult = await this.mutations.scheduleAppointment({
      appointmentParams: scheduleAppointment,
      requestHeaders: this.defaultUserRequestHeaders,
    });

    expect(appointmentResult.status).toEqual(AppointmentStatus.scheduled);

    expect(appointmentResult.memberId).toEqual(scheduleAppointment.memberId);
    expect(appointmentResult.userId).toEqual(scheduleAppointment.userId);
    expect(new Date(appointmentResult.start)).toEqual(scheduleAppointment.start);
    expect(new Date(appointmentResult.end)).toEqual(scheduleAppointment.end);
    expect(appointmentResult.link).toEqual(generateAppointmentLink(appointmentResult.id));

    return appointmentResult;
  };

  endAppointment = async (id: string): Promise<Appointment> => {
    const endAppointmentParams = generateEndAppointmentParams({ id });
    return this.mutations.endAppointment({
      endAppointmentParams,
      requestHeaders: this.defaultUserRequestHeaders,
    });
  };
}
