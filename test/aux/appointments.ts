import { Appointment, AppointmentStatus } from '../../src/appointment';
import { Member } from '../../src/member';
import { generateEndAppointmentParams } from '../generators';
import {
  generateAppointmentLink,
  generateRequestAppointmentParams,
  generateScheduleAppointmentParams,
} from '../index';
import { Mutations } from './mutations';

export class AppointmentsIntegrationActions {
  constructor(private readonly mutations: Mutations) {}

  requestAppointment = async (userId: string, member: Member): Promise<Appointment> => {
    const appointmentParams = generateRequestAppointmentParams({
      memberId: member.id,
      userId,
    });
    const appointmentResult = await this.mutations.requestAppointment({
      appointmentParams,
    });

    expect(appointmentResult.userId).toEqual(userId);
    expect(appointmentResult.memberId).toEqual(member.id);
    expect(new Date(appointmentResult.notBefore)).toEqual(new Date(appointmentParams.notBefore));
    expect(appointmentResult.status).toEqual(AppointmentStatus.requested);
    expect(appointmentResult.link).toEqual(generateAppointmentLink(appointmentResult.id));

    return appointmentResult;
  };

  scheduleAppointment = async (userId: string, member: Member): Promise<Appointment> => {
    const scheduleAppointment = generateScheduleAppointmentParams({
      memberId: member.id,
      userId,
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
    userId: string,
    member: Member,
    start: Date,
    end: Date,
  ): Promise<Appointment> => {
    const scheduleAppointment = generateScheduleAppointmentParams({
      memberId: member.id,
      userId,
      start,
      end,
    });

    const appointmentResult = await this.mutations.scheduleAppointment({
      appointmentParams: scheduleAppointment,
    });

    expect(appointmentResult.status).toEqual(AppointmentStatus.scheduled);

    return appointmentResult;
  };

  requestAppointmentWithDate = async (
    userId: string,
    member: Member,
    notBefore: Date,
  ): Promise<Appointment> => {
    const appointmentParams = generateRequestAppointmentParams({
      memberId: member.id,
      userId,
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
