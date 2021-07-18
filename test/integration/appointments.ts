import { Member } from '../../src/member';
import {
  Appointment,
  AppointmentStatus,
  Note,
  Scores,
} from '../../src/appointment';
import {
  generateNoShowAppointmentParams,
  generateRequestAppointmentParams,
  generateScheduleAppointmentParams,
} from '../index';
import { Mutations } from './mutations';

export class AppointmentsIntegrationActions {
  constructor(private readonly mutations: Mutations) {}

  requestAppointment = async (
    userId: string,
    member: Member,
  ): Promise<Appointment> => {
    const appointmentParams = generateRequestAppointmentParams({
      memberId: member.id,
      userId,
    });
    const appointmentResult = await this.mutations.requestAppointment({
      appointmentParams,
    });

    expect(appointmentResult.userId).toEqual(userId);
    expect(appointmentResult.memberId).toEqual(member.id);
    expect(new Date(appointmentResult.notBefore)).toEqual(
      new Date(appointmentParams.notBefore),
    );
    expect(appointmentResult.status).toEqual(AppointmentStatus.requested);

    return appointmentResult;
  };

  scheduleAppointment = async (
    userId: string,
    member: Member,
  ): Promise<Appointment> => {
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
    expect(new Date(appointmentResult.notBefore)).toEqual(
      scheduleAppointment.notBefore,
    );
    expect(new Date(appointmentResult.start)).toEqual(
      scheduleAppointment.start,
    );
    expect(new Date(appointmentResult.end)).toEqual(scheduleAppointment.end);

    return appointmentResult;
  };

  endAppointment = async (id: string): Promise<Appointment> => {
    const appointment = await this.mutations.endAppointment({ id });
    expect(appointment.status).toEqual(AppointmentStatus.done);
    return appointment;
  };

  freezeAppointment = async (id: string): Promise<Appointment> => {
    const appointment = await this.mutations.freezeAppointment({ id });
    expect(appointment.status).toEqual(AppointmentStatus.closed);
    return appointment;
  };

  showAppointment = async (id: string): Promise<Appointment> => {
    const noShowParams = generateNoShowAppointmentParams({ id });
    const appointment = await this.mutations.noShowAppointment({
      noShowParams,
    });

    expect(noShowParams).toEqual(expect.objectContaining(appointment.noShow));

    return appointment;
  };

  setNotes = async (id: string, notes: Note[], scores?: Scores) => {
    await this.mutations.setNotes({
      params: { appointmentId: id, notes, scores: scores },
    });
  };
}
