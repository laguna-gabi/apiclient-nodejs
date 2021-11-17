import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import * as faker from 'faker';
import { Model, model } from 'mongoose';
import { v4 } from 'uuid';
import {
  Appointment,
  AppointmentDto,
  AppointmentMethod,
  AppointmentModule,
  AppointmentService,
  EndAppointmentParams,
} from '../../src/appointment';
import {
  AppointmentStatus,
  ErrorType,
  Errors,
  EventType,
  IEventOnNewAppointment,
  IEventOnUpdatedAppointmentScores,
  IEventUnconsentedAppointmentEnded,
} from '../../src/common';
import {
  dbConnect,
  dbDisconnect,
  defaultModules,
  generateAppointmentLink,
  generateId,
  generateNotesParams,
  generateObjectId,
  generateRequestAppointmentParams,
  generateScheduleAppointmentParams,
  generateUpdateNotesParams,
} from '../index';

describe('AppointmentService', () => {
  let module: TestingModule;
  let service: AppointmentService;
  let eventEmitter: EventEmitter2;
  let appointmentModel: Model<typeof AppointmentDto>;
  let spyOnEventEmitter;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: defaultModules().concat(AppointmentModule),
    }).compile();

    service = module.get<AppointmentService>(AppointmentService);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);

    appointmentModel = model(Appointment.name, AppointmentDto);
    spyOnEventEmitter = jest.spyOn(eventEmitter, 'emit');

    await dbConnect();
  });

  afterAll(async () => {
    await module.close();
    await dbDisconnect();
  });

  afterEach(() => {
    spyOnEventEmitter.mockReset();
  });

  describe('get', () => {
    it('should return null for non existing appointment', async () => {
      const id = generateObjectId();
      const result = await service.get(id.toString());
      expect(result).toBeNull();
    });

    it('should return appointment set up for a user and member', async () => {
      const appointment = generateRequestAppointmentParams();
      const { id } = await service.request(appointment);

      const result = await service.get(id);

      expect(result).toEqual(
        expect.objectContaining({
          _id: generateObjectId(id),
          userId: appointment.userId,
          memberId: generateObjectId(appointment.memberId),
          notBefore: appointment.notBefore,
          status: AppointmentStatus.requested,
          link: generateAppointmentLink(id),
          updatedAt: expect.any(Date),
        }),
      );
    });

    it('should return a scheduled appointment', async () => {
      const appointment = generateScheduleAppointmentParams();
      const { id } = await service.schedule(appointment);

      const result = await service.get(id);
      expect(result.status).toEqual(AppointmentStatus.scheduled);
      validateNewAppointmentEvent(appointment.memberId, appointment.userId, id);
    });
  });

  describe('request', () => {
    it('should insert a new appointment and validate all insert fields', async () => {
      const appointmentParams = generateRequestAppointmentParams();
      const result = await service.request(appointmentParams);

      validateNewAppointmentEvent(appointmentParams.memberId, appointmentParams.userId, result.id);
      expect(result).toEqual(
        expect.objectContaining({
          id: result.id,
          notBefore: result.notBefore,
          status: AppointmentStatus.requested,
          link: generateAppointmentLink(result.id),
          updatedAt: expect.any(Date),
        }),
      );

      const resultGet = await appointmentModel.findById(result.id);

      expect(resultGet).toEqual(
        expect.objectContaining({
          _id: generateObjectId(result.id),
          userId: appointmentParams.userId,
          memberId: generateObjectId(appointmentParams.memberId),
          notBefore: appointmentParams.notBefore,
          status: AppointmentStatus.requested,
          link: generateAppointmentLink(result.id),
          updatedAt: expect.any(Date),
        }),
      );
    });

    it('should update an appointment notBefore for an existing memberId and userId', async () => {
      const memberId = generateId();
      const userId = v4();

      const { id: id1, record: record1 } = await requestAppointment({
        memberId,
        userId,
        notBeforeHours: 12,
      });
      validateNewAppointmentEvent(memberId, userId, id1);

      const {
        notBefore,
        id: id2,
        record: record2,
      } = await requestAppointment({
        memberId,
        userId,
        notBeforeHours: 8,
      });
      expect(spyOnEventEmitter).not.toBeCalled();

      expect(id1).toEqual(id2);

      expect(record2).toEqual(
        expect.objectContaining({
          id: record1.id,
          userId,
          memberId: generateObjectId(memberId),
          notBefore,
          status: AppointmentStatus.requested,
          link: generateAppointmentLink(record1.id),
          updatedAt: expect.any(Date),
        }),
      );
    });

    it('should override userId when called with existing appointmentId ', async () => {
      const requestAppointmentParams = generateRequestAppointmentParams();
      const { id } = await service.request(requestAppointmentParams);

      validateNewAppointmentEvent(
        requestAppointmentParams.memberId,
        requestAppointmentParams.userId,
        id,
      );
      expect(id).not.toBeNull();

      const newUserId = generateId();
      const updatedRequestAppointmentParams = generateRequestAppointmentParams({
        userId: newUserId,
      });
      updatedRequestAppointmentParams['id'] = id;
      const { id: appId, userId } = await service.request(updatedRequestAppointmentParams);

      expect(id).toEqual(appId);
      expect(userId).toEqual(newUserId);
    });

    it('should crate a new appointment for an existing memberId and different userId', async () => {
      const memberId = generateId();
      const userId1 = v4();
      const userId2 = v4();

      const { id: id1, record: record1 } = await requestAppointment({
        memberId,
        userId: userId1,
        notBeforeHours: 5,
      });
      validateNewAppointmentEvent(memberId, userId1, id1);

      const { id: id2, record: record2 } = await requestAppointment({
        memberId,
        userId: userId2,
        notBeforeHours: 2,
      });
      validateNewAppointmentEvent(memberId, userId2, id2);

      expect(record1.memberId).toEqual(record2.memberId);
      expect(record1.userId).not.toEqual(record2.userId);
      compare(record1, record2);
    });

    it('should crate a new appointment for an existing userId and different memberId', async () => {
      const memberId1 = generateId();
      const memberId2 = generateId();
      const userId = v4();

      const { id: id1, record: record1 } = await requestAppointment({
        memberId: memberId1,
        userId,
        notBeforeHours: 5,
      });
      validateNewAppointmentEvent(memberId1, userId, id1);

      const { id: id2, record: record2 } = await requestAppointment({
        memberId: memberId2,
        userId,
        notBeforeHours: 2,
      });
      validateNewAppointmentEvent(memberId2, userId, id2);

      expect(record1.userId).toEqual(record2.userId);
      expect(record1.memberId).not.toEqual(record2.memberId);
      compare(record1, record2);
    });

    it('should check that createdAt and updatedAt exists in the collection', async () => {
      const params = generateRequestAppointmentParams();
      const { id } = await service.request(params);

      validateNewAppointmentEvent(params.memberId, params.userId, id);

      const createdAppointment: any = await appointmentModel.findById(id);
      expect(createdAppointment.createdAt).toEqual(expect.any(Date));
      expect(createdAppointment.updatedAt).toEqual(expect.any(Date));
    });

    it('should create a new request appointment on exising scheduled', async () => {
      const memberId = generateId();
      const userId = v4();
      const scheduleParams = generateScheduleAppointmentParams({ userId, memberId });
      const requestParams = generateRequestAppointmentParams({ userId, memberId });

      const scheduleAppointment = await service.schedule(scheduleParams);
      validateNewAppointmentEvent(memberId, userId, scheduleAppointment.id);
      spyOnEventEmitter.mockReset();

      const requestAppointment = await service.request(requestParams);
      validateNewAppointmentEvent(memberId, userId, requestAppointment.id);

      expect(scheduleAppointment.id).not.toEqual(requestAppointment.id);
    });

    const compare = (record1, record2) => {
      expect(record1.status).toEqual(record2.status);
      expect(record1.createdAt).not.toEqual(record2.createdAt);
      expect(record1.notBefore).not.toEqual(record2.notBefore);
      expect(record1.updatedAt).not.toEqual(record2.updatedAt);
    };
  });

  describe('schedule', () => {
    it('should be able to schedule an appointment', async () => {
      const appointmentParams = generateScheduleAppointmentParams();
      const appointment = await service.schedule(appointmentParams);

      validateNewAppointmentEvent(
        appointmentParams.memberId,
        appointmentParams.userId,
        appointment.id,
      );

      expect(appointment).toEqual(
        expect.objectContaining({
          id: appointment.id,
          method: appointmentParams.method,
          status: AppointmentStatus.scheduled,
          link: generateAppointmentLink(appointment.id),
          updatedAt: expect.any(Date),
        }),
      );
    });

    it('should not override end appointment on a new schedule appointment', async () => {
      let endedAppointment = await service.schedule(generateScheduleAppointmentParams());
      endedAppointment = await service.end({ id: endedAppointment.id });

      const appointmentParams = generateScheduleAppointmentParams();
      const newAppointment = await service.schedule(appointmentParams);

      expect(endedAppointment.id).not.toEqual(newAppointment.id);
      expect(endedAppointment.status).toEqual(AppointmentStatus.done);
      expect(newAppointment.status).toEqual(AppointmentStatus.scheduled);
    });

    it('should override an appointment when id is passed', async () => {
      const params1 = generateScheduleAppointmentParams();
      const { id } = await service.schedule(params1);

      const params2 = generateScheduleAppointmentParams({
        id,
        method: AppointmentMethod.phoneCall,
      });
      const appointment = await service.schedule(params2);

      expect(appointment.id).toEqual(params2.id);
      expect(appointment.userId).toEqual(params2.userId);
      expect(appointment.memberId.toString()).toEqual(params2.memberId);
      expect(appointment.method).toEqual(params2.method);
      expect(appointment.start).toEqual(params2.start);
      expect(appointment.end).toEqual(params2.end);
    });

    it('should schedule multiple appointments for the same user and member', async () => {
      const memberId = generateId();
      const userId = v4();
      const schedule = async (): Promise<Appointment> => {
        const appointmentParams = generateScheduleAppointmentParams({ memberId, userId });
        const result = await service.schedule(appointmentParams);
        validateNewAppointmentEvent(
          appointmentParams.memberId,
          appointmentParams.userId,
          result.id,
        );
        return result;
      };

      const appointment1 = await schedule();
      const appointment2 = await schedule();
      const appointment3 = await schedule();

      expect(appointment1.userId).toEqual(appointment2.userId);
      expect(appointment2.userId).toEqual(appointment3.userId);
      expect(appointment1.memberId).toEqual(appointment2.memberId);
      expect(appointment2.memberId).toEqual(appointment3.memberId);
      expect(appointment1.id).not.toEqual(appointment2.id);
      expect(appointment1.id).not.toEqual(appointment3.id);
      expect(appointment2.id).not.toEqual(appointment3.id);
    });

    it('should override requested appointment on scheduled appointment', async () => {
      const requestAppointmentParams = generateRequestAppointmentParams();
      const { id } = await service.request(requestAppointmentParams);

      validateNewAppointmentEvent(
        requestAppointmentParams.memberId,
        requestAppointmentParams.userId,
        id,
      );
      expect(id).not.toBeNull();

      const scheduleAppointmentParams = generateScheduleAppointmentParams({
        userId: requestAppointmentParams.userId,
        memberId: requestAppointmentParams.memberId,
      });

      const { id: scheduledId } = await service.schedule(scheduleAppointmentParams);

      expect(id).toEqual(scheduledId);
      expect(spyOnEventEmitter).not.toBeCalled();
    });

    it('should override requested appointment when calling schedule appointment', async () => {
      const requestAppointmentParams = generateRequestAppointmentParams();
      const { id: requestedId } = await service.request(requestAppointmentParams);

      const scheduledAppointmentParams = generateScheduleAppointmentParams({
        memberId: requestAppointmentParams.memberId,
        userId: requestAppointmentParams.userId,
      });
      const { id: scheduledId } = await service.schedule(scheduledAppointmentParams);

      expect(requestedId).toEqual(scheduledId);
      const result = await service.get(scheduledId);
      expect(new Date(result.end)).toEqual(scheduledAppointmentParams.end);
      expect(new Date(result.start)).toEqual(scheduledAppointmentParams.start);
    });

    it('should create multiple new scheduled appointments', async () => {
      const scheduledAppointment1 = generateScheduleAppointmentParams({
        method: AppointmentMethod.chat,
      });
      const { id: requestedId } = await service.schedule(scheduledAppointment1);

      const scheduledAppointment2 = generateScheduleAppointmentParams({
        memberId: scheduledAppointment1.memberId,
        userId: scheduledAppointment1.userId,
        method: AppointmentMethod.videoCall,
      });
      const { id: scheduledId } = await service.schedule(scheduledAppointment2);

      expect(requestedId).not.toEqual(scheduledId);
    });
  });

  describe('end', () => {
    it('should not be able to end a non existing appointment', async () => {
      await expect(service.end({ id: generateId() })).rejects.toThrow(
        Errors.get(ErrorType.appointmentIdNotFound),
      );
    });

    const noShowReason = faker.lorem.sentence();

    /* eslint-disable max-len */
    test.each`
      update1                               | update2
      ${{ noShow: true, noShowReason }} | ${{
  noShow: true,
  noShowReason: faker.lorem.sentence(),
  notes: generateNotesParams(),
}}
      ${{ noShow: true, noShowReason }}     | ${{ noShow: false, noShowReason: null }}
      ${{ noShow: false }}                  | ${{ noShow: true, noShowReason }}
      ${{ notes: generateNotesParams() }}   | ${{ noShow: true }}
      ${{ notes: generateNotesParams() }}   | ${{ notes: null }}
      ${{ notes: generateNotesParams() }}   | ${{ notes: generateNotesParams(), noShow: false }}
      ${{ notes: generateNotesParams() }}   | ${{ notes: null, noShow: true, noShowReason }}
      ${{ notes: null }}                    | ${{ notes: generateNotesParams(), noShow: true, noShowReason }}
      ${{ notes: undefined, noShow: true }} | ${{ notes: generateNotesParams(), noShow: false }}
    `(
      `should be able to multiple update existing appointment : $update1 and $update2`,
      /* eslint-enable max-len */
      async (params) => {
        const appointmentParams = generateScheduleAppointmentParams();
        const appointment = await service.schedule(appointmentParams);

        validateNewAppointmentEvent(
          appointmentParams.memberId,
          appointmentParams.userId,
          appointment.id,
        );

        const updateShowParams1: EndAppointmentParams = {
          id: appointment.id,
          ...params.update1,
        };
        await service.end(updateShowParams1);

        const updateShowParams2: EndAppointmentParams = {
          id: appointment.id,
          ...params.update2,
        };
        const result = await service.end(updateShowParams2);

        expect(result.noShow).toEqual(
          params.update2.noShow !== undefined ? params.update2.noShow : params.update1.noShow,
        );
        expect(result.noShowReason).toEqual(
          params.update2.noShowReason !== undefined
            ? params.update2.noShowReason
            : params.update1.noShowReason,
        );
        expect(result.notes).toEqual(
          params.update1.notes === undefined && params.update2.notes === undefined
            ? undefined
            : expect.objectContaining(
                params.update2.notes !== undefined ? params.update2.notes : params.update1.notes,
              ),
        );
      },
    );

    it('should validate that on insert notes, an internal event is sent', async () => {
      const appointmentParams = generateScheduleAppointmentParams();
      const resultAppointment = await service.schedule(appointmentParams);

      const notes = generateNotesParams();
      const spyOnEventEmitter = jest.spyOn(eventEmitter, 'emit');
      const endAppointmentParams: EndAppointmentParams = { id: resultAppointment.id, notes };
      await service.end(endAppointmentParams);

      const eventParams: IEventOnUpdatedAppointmentScores = {
        memberId: generateObjectId(appointmentParams.memberId),
        scores: notes.scores,
      };
      expect(spyOnEventEmitter).toBeCalledWith(EventType.onUpdatedAppointmentScores, eventParams);

      spyOnEventEmitter.mockReset();
    });

    /* eslint-disable */
    test.each`
      recordingConsent | noShow   | expectToDispatch | title
      ${false}         | ${false} | ${true}          | ${'should dispatch event if showed up and no consent'}
      ${true}          | ${false} | ${false}         | ${'should not dispatch event if showed up and have consent'}
      ${true}          | ${true}  | ${false}         | ${'should not dispatch event if didnt show up and have consent'}
      ${true}          | ${true}  | ${false}         | ${'should not dispatch event if didnt show up and no consent'}
    `(`$title`, async ({ recordingConsent, noShow, expectToDispatch }) => {
      /* eslint-enable */
      const spyOnEventEmitter = jest.spyOn(eventEmitter, 'emit');
      const appointmentParams = generateScheduleAppointmentParams();
      const notes = generateNotesParams();
      const resultAppointment = await service.schedule(appointmentParams);
      spyOnEventEmitter.mockClear();
      expect(spyOnEventEmitter).not.toBeCalled();
      await service.end({
        id: resultAppointment.id,
        notes,
        noShow,
        recordingConsent,
      });

      if (expectToDispatch) {
        const eventParams: IEventUnconsentedAppointmentEnded = {
          appointmentId: resultAppointment.id,
          memberId: resultAppointment.memberId.toString(),
        };
        expect(spyOnEventEmitter).toBeCalledWith(
          EventType.onUnconsentedAppointmentEnded,
          eventParams,
        );
      } else {
        expect(spyOnEventEmitter).not.toBeCalledWith(
          EventType.onUnconsentedAppointmentEnded,
          expect.anything(),
        );
      }

      spyOnEventEmitter.mockReset();
    });
  });

  describe('updateNotes', () => {
    it('should not be able to update non existing appointment', async () => {
      await expect(service.updateNotes(generateUpdateNotesParams())).rejects.toThrow(
        Errors.get(ErrorType.appointmentIdNotFound),
      );
    });

    it('should create notes for a given appointment id', async () => {
      const appointmentParams = generateScheduleAppointmentParams();
      const resultAppointment = await service.schedule(appointmentParams);

      expect(resultAppointment.notes).toBeUndefined();

      const updateNotesParams = generateUpdateNotesParams({
        appointmentId: resultAppointment.id,
      });
      await service.updateNotes(updateNotesParams);
      const result = await service.get(resultAppointment.id);

      expect(result.notes).toMatchObject(updateNotesParams.notes);
    });

    it('should update notes for a given appointment id', async () => {
      const appointmentParams = generateScheduleAppointmentParams();
      const resultAppointment = await service.schedule(appointmentParams);

      const notes = generateNotesParams();
      let updateNotesParams = generateUpdateNotesParams({
        appointmentId: resultAppointment.id,
        notes,
      });
      await service.updateNotes(updateNotesParams);
      let result = await service.get(resultAppointment.id);
      expect(result.notes).toMatchObject(notes);

      const newNotes = generateNotesParams();
      updateNotesParams = generateUpdateNotesParams({
        appointmentId: resultAppointment.id,
        notes: newNotes,
      });
      await service.updateNotes(updateNotesParams);
      result = await service.get(resultAppointment.id);
      expect(result.notes).toMatchObject(newNotes);
    });

    it('should remove the notes for a given appointment id', async () => {
      const appointmentParams = generateScheduleAppointmentParams();
      const resultAppointment = await service.schedule(appointmentParams);
      const notes = generateNotesParams();
      let updateNotesParams = generateUpdateNotesParams({
        appointmentId: resultAppointment.id,
        notes,
      });
      await service.updateNotes(updateNotesParams);

      updateNotesParams = generateUpdateNotesParams({
        appointmentId: resultAppointment.id,
        notes: null,
      });
      await service.updateNotes(updateNotesParams);
      const result = await service.get(resultAppointment.id);

      expect(result.notes).toBeNull();
    });
  });

  describe('getFutureAppointments', () => {
    it('should get only future appointments that are not of status done', async () => {
      const userId = generateId();
      const memberId = generateId();

      // schedule past appointments
      const pastAppointments = [];
      for (let step = 0; step < 3; step++) {
        const pastAppointment = generateScheduleAppointmentParams({
          start: faker.date.recent(4),
          userId,
          memberId,
        });
        pastAppointments.push(await service.schedule(pastAppointment));
      }

      // schedule future appointments
      const futureAppointments = [];
      for (let step = 0; step < 3; step++) {
        const futureAppointment = generateScheduleAppointmentParams({
          userId,
          memberId,
        });
        futureAppointments.push(await service.schedule(futureAppointment));
      }

      // change one of the future appointments to 'done'
      await service.end({ id: futureAppointments[0].id.toString() });

      const result = await service.getFutureAppointments(userId, memberId);
      futureAppointments.shift();
      expect(result).toEqual(futureAppointments);
    });
  });

  const requestAppointment = async ({
    memberId,
    userId,
    notBeforeHours,
  }: {
    memberId: string;
    userId: string;
    notBeforeHours: number;
  }) => {
    const notBefore = new Date();
    notBefore.setHours(notBeforeHours);

    const appointmentParams = generateRequestAppointmentParams({
      memberId,
      userId,
      notBefore,
    });

    const result = await service.request(appointmentParams);
    expect(result.id).not.toBeUndefined();

    const record: any = await appointmentModel.findById(result.id);
    return { notBefore, id: result.id, record };
  };

  const validateNewAppointmentEvent = (memberId: string, userId: string, appointmentId: string) => {
    const eventParams: IEventOnNewAppointment = { memberId, appointmentId, userId };
    expect(spyOnEventEmitter).toBeCalledWith(EventType.onNewAppointment, eventParams);
    spyOnEventEmitter.mockReset();
  };
});
