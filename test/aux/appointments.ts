import { Appointment, AppointmentStatus } from '../../src/appointment';
import { Member } from '../../src/member';
import {
  generateAppointmentLink,
  generateEndAppointmentParams,
  generateRequestAppointmentParams,
  generateScheduleAppointmentParams,
} from '..';
import { Mutations } from '.';

export class AppointmentsIntegrationActions {
  constructor(private readonly mutations: Mutations) {}

  requestAppointment = async ({
    userId,
    member,
  }: {
    userId?: string;
    member: Member;
  }): Promise<Appointment> => {
    const appointmentParams = generateRequestAppointmentParams({
      memberId: member.id,
      userId: userId || member.primaryUserId.toString(),
    });
    const appointmentResult = await this.mutations.requestAppointment({
      appointmentParams,
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
    });

    expect(appointmentResult.status).toEqual(AppointmentStatus.scheduled);

    expect(appointmentResult.memberId).toEqual(scheduleAppointment.memberId);
    expect(appointmentResult.userId).toEqual(scheduleAppointment.userId);
    expect(new Date(appointmentResult.start)).toEqual(scheduleAppointment.start);
    expect(new Date(appointmentResult.end)).toEqual(scheduleAppointment.end);
    expect(appointmentResult.link).toEqual(generateAppointmentLink(appointmentResult.id));

    return appointmentResult;
  };

  scheduleAppointmentWithDate = async (
    member: Member,
    start: Date,
    end: Date,
  ): Promise<Appointment> => {
    const appointmentParams = generateScheduleAppointmentParams({
      memberId: member.id,
      userId: member.primaryUserId.toString(),
      start,
      end,
    });

    const appointmentResult = await this.mutations.scheduleAppointment({ appointmentParams });

    expect(appointmentResult.status).toEqual(AppointmentStatus.scheduled);

    return appointmentResult;
  };

  requestAppointmentWithDate = async (member: Member, notBefore: Date): Promise<Appointment> => {
    const appointmentParams = generateRequestAppointmentParams({
      memberId: member.id,
      userId: member.primaryUserId.toString(),
      notBefore,
    });
    return this.mutations.requestAppointment({
      appointmentParams,
    });
  };

  endAppointment = async (id: string): Promise<Appointment> => {
    const endAppointmentParams = generateEndAppointmentParams({ id });
    return this.mutations.endAppointment({ endAppointmentParams });
  };
}
