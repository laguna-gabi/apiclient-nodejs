import {
  add,
  areIntervalsOverlapping,
  differenceInMinutes,
  isAfter,
  isSameDay,
  startOfToday,
  startOfTomorrow,
} from 'date-fns';
import { Member } from '../../src/member';
import { defaultSlotsParams } from '../../src/user';
import { generateAvailabilityInput } from './../generators';
import { AppointmentsIntegrationActions } from './aux/appointments';
import { Creators } from './aux/creators';
import { Handler } from './aux/handler';

describe('Integration tests : getUserSlots', () => {
  const handler: Handler = new Handler();
  let creators: Creators;
  let appointmentsActions: AppointmentsIntegrationActions;

  beforeAll(async () => {
    await handler.beforeAll();
    appointmentsActions = new AppointmentsIntegrationActions(handler.mutations);
    creators = new Creators(handler, appointmentsActions);
  });

  afterAll(async () => {
    await handler.afterAll();
  });

  it('should return objects with all slots', async () => {
    const { primaryUser, member } = await createUserMember();

    await handler.mutations.createAvailabilities({
      availabilities: [
        generateAvailabilityInput({
          start: add(startOfToday(), { hours: 10 }),
          end: add(startOfToday(), { hours: 22 }),
          userId: primaryUser.id,
        }),
        generateAvailabilityInput({
          start: add(startOfTomorrow(), { hours: 10 }),
          end: add(startOfTomorrow(), { hours: 22 }),
          userId: primaryUser.id,
        }),
      ],
    });

    const appointment = await appointmentsActions.scheduleAppointmentWithDate(
      primaryUser.id,
      member,
      add(startOfToday(), { hours: 9 }),
      add(startOfToday(), { hours: 9, minutes: defaultSlotsParams.duration }),
    );

    const result = await handler.queries.getUserSlots({
      appointmentId: appointment.id,
      notBefore: add(startOfToday(), { hours: 10 }),
    });

    expect(result).toEqual(
      expect.objectContaining({
        user: {
          id: primaryUser.id,
          firstName: primaryUser.firstName,
          roles: primaryUser.roles,
          avatar: primaryUser.avatar,
          description: primaryUser.description,
        },
        member: {
          id: member.id,
          firstName: member.firstName,
        },
        appointment: {
          id: appointment.id,
          start: appointment.start,
          method: appointment.method,
          duration: defaultSlotsParams.duration,
        },
      }),
    );
  });

  it('there should not be a slot overlapping a scheduled appointment', async () => {
    const { primaryUser, member } = await createUserMember();

    await handler.mutations.createAvailabilities({
      availabilities: [
        generateAvailabilityInput({
          start: add(startOfToday(), { hours: 10 }),
          end: add(startOfToday(), { hours: 22 }),
          userId: primaryUser.id,
        }),
        generateAvailabilityInput({
          start: add(startOfTomorrow(), { hours: 10 }),
          end: add(startOfTomorrow(), { hours: 22 }),
          userId: primaryUser.id,
        }),
      ],
    });

    const appointment = await appointmentsActions.scheduleAppointmentWithDate(
      primaryUser.id,
      member,
      add(startOfToday(), { hours: 11 }),
      add(startOfToday(), { hours: 11, minutes: defaultSlotsParams.duration }),
    );

    const result = await handler.queries.getUserSlots({
      appointmentId: appointment.id,
      notBefore: add(startOfToday(), { hours: 10 }),
    });

    for (let index = 0; index < defaultSlotsParams.maxSlots; index++) {
      expect(
        areIntervalsOverlapping(
          {
            start: new Date(result.slots[index]),
            end: add(new Date(result.slots[index]), {
              minutes: defaultSlotsParams.duration,
            }),
          },
          {
            start: new Date(appointment.start),
            end: new Date(appointment.end),
          },
        ),
      ).toEqual(false);
    }
  });

  it('should get slots that overlap appointments that are not scheduled', async () => {
    const { primaryUser, member } = await createUserMember();
    const { member: anotherMember } = await createUserMember();

    await handler.mutations.createAvailabilities({
      availabilities: [
        generateAvailabilityInput({
          start: add(startOfToday(), { hours: 10 }),
          end: add(startOfToday(), { hours: 22 }),
          userId: primaryUser.id,
        }),
        generateAvailabilityInput({
          start: add(startOfTomorrow(), { hours: 10 }),
          end: add(startOfTomorrow(), { hours: 22 }),
          userId: primaryUser.id,
        }),
      ],
    });

    const appointment = await appointmentsActions.scheduleAppointmentWithDate(
      primaryUser.id,
      member,
      add(startOfToday(), { hours: 9 }),
      add(startOfToday(), { hours: 9, minutes: defaultSlotsParams.duration }),
    );

    const requestedAppointment = await appointmentsActions.requestAppointmentWithDate(
      primaryUser.id,
      member,
      add(startOfTomorrow(), { hours: 10 }),
    );

    const freezedAppointment = await appointmentsActions.scheduleAppointmentWithDate(
      primaryUser.id,
      anotherMember,
      add(startOfToday(), { hours: 10 }),
      add(startOfToday(), { hours: 10, minutes: defaultSlotsParams.duration }),
    );

    await appointmentsActions.freezeAppointment(freezedAppointment.id);

    const endAppointment = await appointmentsActions.scheduleAppointmentWithDate(
      primaryUser.id,
      member,
      add(startOfToday(), { hours: 11 }),
      add(startOfToday(), { hours: 11, minutes: defaultSlotsParams.duration }),
    );

    await appointmentsActions.endAppointment(endAppointment.id);

    const result = await handler.queries.getUserSlots({
      appointmentId: appointment.id,
      notBefore: add(startOfToday(), { hours: 10 }),
    });

    expect(
      result.slots.some((slot) => {
        return areIntervalsOverlapping(
          {
            start: new Date(requestedAppointment.notBefore),
            end: add(new Date(requestedAppointment.notBefore), {
              minutes: defaultSlotsParams.duration,
            }),
          },
          {
            start: new Date(slot),
            end: add(new Date(slot), { minutes: defaultSlotsParams.duration }),
          },
        );
      }),
    ).toEqual(true);
    expect(
      result.slots.some((slot) => {
        return areIntervalsOverlapping(
          {
            start: new Date(freezedAppointment.start),
            end: new Date(freezedAppointment.end),
          },
          {
            start: new Date(slot),
            end: add(new Date(slot), { minutes: defaultSlotsParams.duration }),
          },
        );
      }),
    ).toEqual(true);
    expect(
      result.slots.some((slot) => {
        return areIntervalsOverlapping(
          {
            start: new Date(endAppointment.start),
            end: new Date(endAppointment.end),
          },
          {
            start: new Date(slot),
            end: add(new Date(slot), { minutes: defaultSlotsParams.duration }),
          },
        );
      }),
    ).toEqual(true);
  });

  it('should return no slots if availability in the past', async () => {
    const { primaryUser, member } = await createUserMember();

    await handler.mutations.createAvailabilities({
      availabilities: [
        generateAvailabilityInput({
          start: add(startOfToday(), { hours: 8 }),
          end: add(startOfToday(), { hours: 10 }),
          userId: primaryUser.id,
        }),
      ],
    });

    const appointment = await appointmentsActions.scheduleAppointmentWithDate(
      primaryUser.id,
      member,
      add(startOfToday(), { hours: 8 }),
      add(startOfToday(), { hours: 8, minutes: defaultSlotsParams.duration }),
    );

    const result = await handler.queries.getUserSlots({
      appointmentId: appointment.id,
      notBefore: add(startOfToday(), { hours: 12 }),
    });

    expect(result.slots.length).toEqual(0);
  });

  it('should return no slots if there is no availability', async () => {
    const { primaryUser, member } = await createUserMember();

    const appointment = await appointmentsActions.scheduleAppointmentWithDate(
      primaryUser.id,
      member,
      add(startOfToday(), { hours: 9 }),
      add(startOfToday(), { hours: 9, minutes: defaultSlotsParams.duration }),
    );

    const result = await handler.queries.getUserSlots({
      appointmentId: appointment.id,
      notBefore: add(startOfToday(), { hours: 10 }),
    });

    expect(result.slots.length).toEqual(0);
  });

  it('should return 5 slots from today and the next from tomorrow', async () => {
    const { primaryUser, member } = await createUserMember();

    await handler.mutations.createAvailabilities({
      availabilities: [
        generateAvailabilityInput({
          start: add(startOfToday(), { hours: 10 }),
          end: add(startOfToday(), { hours: 22 }),
          userId: primaryUser.id,
        }),
        generateAvailabilityInput({
          start: add(startOfTomorrow(), { hours: 10 }),
          end: add(startOfTomorrow(), { hours: 22 }),
          userId: primaryUser.id,
        }),
      ],
    });

    const appointment = await appointmentsActions.scheduleAppointmentWithDate(
      primaryUser.id,
      member,
      add(startOfToday(), { hours: 9 }),
      add(startOfToday(), { hours: 9, minutes: defaultSlotsParams.duration }),
    );

    const result = await handler.queries.getUserSlots({
      appointmentId: appointment.id,
      notBefore: add(startOfToday(), { hours: 10 }),
    });

    for (let index = 0; index < 5; index++) {
      expect(isSameDay(new Date(result.slots[index]), add(startOfToday(), { hours: 12 }))).toEqual(
        true,
      );
    }
    for (let index = 5; index < defaultSlotsParams.maxSlots; index++) {
      expect(
        isSameDay(new Date(result.slots[index]), add(startOfTomorrow(), { hours: 12 })),
      ).toEqual(true);
    }
  });

  it('check slots default properties and order', async () => {
    const { primaryUser, member } = await createUserMember();

    await handler.mutations.createAvailabilities({
      availabilities: [
        generateAvailabilityInput({
          start: add(startOfToday(), { hours: 10 }),
          end: add(startOfToday(), { hours: 22 }),
          userId: primaryUser.id,
        }),
        generateAvailabilityInput({
          start: add(startOfTomorrow(), { hours: 10 }),
          end: add(startOfTomorrow(), { hours: 22 }),
          userId: primaryUser.id,
        }),
      ],
    });

    const appointment = await appointmentsActions.scheduleAppointmentWithDate(
      primaryUser.id,
      member,
      add(startOfToday(), { hours: 9 }),
      add(startOfToday(), { hours: 9, minutes: defaultSlotsParams.duration }),
    );

    const result = await handler.queries.getUserSlots({
      appointmentId: appointment.id,
      notBefore: add(startOfToday(), { hours: 10 }),
    });

    for (let index = 1; index < defaultSlotsParams.maxSlots; index++) {
      expect(
        differenceInMinutes(new Date(result.slots[index]), new Date(result.slots[index - 1])),
      ).toBeGreaterThanOrEqual(defaultSlotsParams.duration);
      expect(isAfter(new Date(result.slots[index]), new Date(result.slots[index - 1]))).toEqual(
        true,
      );
    }
    expect(result.slots.length).toEqual(defaultSlotsParams.maxSlots);
  });

  const createUserMember = async () => {
    const primaryUser = await creators.createAndValidateUser();
    const org = await creators.createAndValidateOrg();
    const member: Member = await creators.createAndValidateMember({
      org,
      primaryUser,
      users: [primaryUser],
    });
    return { primaryUser, member };
  };
});
