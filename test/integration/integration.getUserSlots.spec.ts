import {
  add,
  areIntervalsOverlapping,
  differenceInMinutes,
  isAfter,
  isSameDay,
  startOfToday,
  startOfTomorrow,
} from 'date-fns';
import { EventType, SlackChannel, SlackIcon } from '../../src/common';
import { Member } from '../../src/member';
import { defaultSlotsParams } from '../../src/user';
import { AppointmentsIntegrationActions } from '../aux/appointments';
import { Creators } from '../aux/creators';
import { Handler } from '../aux/handler';
import { generateAvailabilityInput } from './../';

describe('Integration tests : getUserSlots', () => {
  const handler: Handler = new Handler();
  let creators: Creators;
  let appointmentsActions: AppointmentsIntegrationActions;
  let spyOnEventEmitter;

  beforeAll(async () => {
    await handler.beforeAll();
    appointmentsActions = new AppointmentsIntegrationActions(handler.mutations);
    creators = new Creators(handler, appointmentsActions);
    handler.mockCommunication();
    await creators.createFirstUserInDbfNecessary();
    spyOnEventEmitter = jest.spyOn(handler.eventEmitter, 'emit');
  });

  afterAll(async () => {
    await handler.afterAll();
  });

  afterEach(async () => {
    spyOnEventEmitter.mockReset();
  });

  it('should return objects with all slots', async () => {
    const org = await creators.createAndValidateOrg();
    const member: Member = await creators.createAndValidateMember({ org });
    const user = await handler.setContextUserId(member.primaryUserId).queries.getUser();

    await createDefaultAvailabilities(member.primaryUserId);

    const appointment = await appointmentsActions.scheduleAppointmentWithDate(
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
          id: user.id,
          firstName: user.firstName,
          roles: user.roles,
          avatar: user.avatar,
          description: user.description,
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
    const org = await creators.createAndValidateOrg();
    const member: Member = await creators.createAndValidateMember({ org });
    await createDefaultAvailabilities(member.primaryUserId);

    const appointment = await appointmentsActions.scheduleAppointmentWithDate(
      member,
      add(startOfToday(), { hours: 11 }),
      add(startOfToday(), { hours: 11, minutes: defaultSlotsParams.duration }),
    );

    const result = await handler.queries.getUserSlots({
      userId: member.primaryUserId,
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

  // eslint-disable-next-line max-len
  it('should return 6 default slots and send message to slack if availability in the past', async () => {
    const user = await creators.createAndValidateUser();
    await handler.setContextUserId(user.id).mutations.createAvailabilities({
      availabilities: [
        generateAvailabilityInput({
          start: add(startOfToday(), { hours: 8 }),
          end: add(startOfToday(), { hours: 10 }),
        }),
      ],
    });

    const result = await handler.queries.getUserSlots({
      userId: user.id,
      notBefore: add(startOfToday(), { hours: 12 }),
    });

    expect(result.slots.length).toEqual(6);
    expect(spyOnEventEmitter).toBeCalledWith(EventType.slackMessage, {
      message: `*No availability*\nUser ${user.id} doesn't have any availability left.`,
      icon: SlackIcon.warning,
      channel: SlackChannel.notifications,
    });

    spyOnEventEmitter.mockReset();
  });

  // eslint-disable-next-line max-len
  it('should return 6 default slots and send message to slack if there is no availability', async () => {
    const user = await creators.createAndValidateUser();
    const result = await handler.queries.getUserSlots({
      userId: user.id,
      notBefore: add(startOfToday(), { hours: 12 }),
    });

    expect(result.slots.length).toEqual(6);
    expect(spyOnEventEmitter).toBeCalledWith(EventType.slackMessage, {
      message: `*No availability*\nUser ${user.id} doesn't have any availability left.`,
      icon: SlackIcon.warning,
      channel: SlackChannel.notifications,
    });

    spyOnEventEmitter.mockReset();
  });

  it('should return 5 slots from today and the next from tomorrow', async () => {
    const result = await preformGetUserSlots();

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
    const result = await preformGetUserSlots();

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

  const preformGetUserSlots = async () => {
    const org = await creators.createAndValidateOrg();
    const member: Member = await creators.createAndValidateMember({ org });
    await createDefaultAvailabilities(member.primaryUserId);

    await appointmentsActions.scheduleAppointmentWithDate(
      member,
      add(startOfToday(), { hours: 9 }),
      add(startOfToday(), { hours: 9, minutes: defaultSlotsParams.duration }),
    );

    return handler.queries.getUserSlots({
      userId: member.primaryUserId,
      notBefore: add(startOfToday(), { hours: 10 }),
    });
  };

  const createDefaultAvailabilities = async (userId: string) => {
    await handler.setContextUserId(userId).mutations.createAvailabilities({
      availabilities: [
        generateAvailabilityInput({
          start: add(startOfToday(), { hours: 10 }),
          end: add(startOfToday(), { hours: 22 }),
        }),
        generateAvailabilityInput({
          start: add(startOfTomorrow(), { hours: 10 }),
          end: add(startOfTomorrow(), { hours: 22 }),
        }),
      ],
    });
  };
});
