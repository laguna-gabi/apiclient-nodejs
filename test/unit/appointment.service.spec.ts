import { Test, TestingModule } from '@nestjs/testing';
import { DbModule } from '../../src/db/db.module';
import { model, Model } from 'mongoose';
import {
  dbConnect,
  dbDisconnect,
  generateAppointmentLink,
  generateId,
  generateNotesParams,
  generateObjectId,
  generateRequestAppointmentParams,
  generateScheduleAppointmentParams,
  generateUpdateNotesParams,
} from '../index';
import {
  Appointment,
  AppointmentDto,
  AppointmentModule,
  AppointmentService,
  AppointmentStatus,
  EndAppointmentParams,
} from '../../src/appointment';
import { Errors, ErrorType, EventType } from '../../src/common';
import * as faker from 'faker';
import { EventEmitter2, EventEmitterModule } from '@nestjs/event-emitter';
import { cloneDeep } from 'lodash';
import { v4 } from 'uuid';

describe('AppointmentService', () => {
  let module: TestingModule;
  let service: AppointmentService;
  let eventEmitter: EventEmitter2;
  let appointmentModel: Model<typeof AppointmentDto>;
  let spyOnEventEmitter;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [DbModule, AppointmentModule, EventEmitterModule.forRoot()],
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
      validateNewAppointmentEvent(appointment.userId, id);
    });
  });

  describe('request', () => {
    it('should insert a new appointment and validate all insert fields', async () => {
      const appointmentParams = generateRequestAppointmentParams();
      const result = await service.request(appointmentParams);

      validateNewAppointmentEvent(appointmentParams.userId, result.id);
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
      validateNewAppointmentEvent(userId, id1);

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

    it('should crate a new appointment for an existing memberId and different userId', async () => {
      const memberId = generateId();
      const userId1 = v4();
      const userId2 = v4();

      const { id: id1, record: record1 } = await requestAppointment({
        memberId,
        userId: userId1,
        notBeforeHours: 5,
      });
      validateNewAppointmentEvent(userId1, id1);

      const { id: id2, record: record2 } = await requestAppointment({
        memberId,
        userId: userId2,
        notBeforeHours: 2,
      });
      validateNewAppointmentEvent(userId2, id2);

      expect(id1).not.toEqual(id2);
      expect(record1.memberId).toEqual(record2.memberId);
      expect(record1.status).toEqual(record2.status);
      expect(record1.createdAt).not.toEqual(record2.createdAt);
      expect(record1.userId).not.toEqual(record2.userId);
      expect(record1.notBefore).not.toEqual(record2.notBefore);
      expect(record1.updatedAt).not.toEqual(record2.updatedAt);
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
      validateNewAppointmentEvent(userId, id1);

      const { id: id2, record: record2 } = await requestAppointment({
        memberId: memberId2,
        userId,
        notBeforeHours: 2,
      });
      validateNewAppointmentEvent(userId, id2);

      expect(id1).not.toEqual(id2);
      expect(record1.userId).toEqual(record2.userId);
      expect(record1.status).toEqual(record2.status);
      expect(record1.memberId).not.toEqual(record2.memberId);
      expect(record1.createdAt).not.toEqual(record2.createdAt);
      expect(record1.notBefore).not.toEqual(record2.notBefore);
      expect(record1.updatedAt).not.toEqual(record2.updatedAt);
    });

    it('should check that createdAt and updatedAt exists in the collection', async () => {
      const params = generateRequestAppointmentParams();
      const { id } = await service.request(params);

      validateNewAppointmentEvent(params.userId, id);

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
      validateNewAppointmentEvent(userId, scheduleAppointment.id);
      spyOnEventEmitter.mockReset();

      const requestAppointment = await service.request(requestParams);
      validateNewAppointmentEvent(userId, requestAppointment.id);

      expect(scheduleAppointment.id).not.toEqual(requestAppointment.id);
    });
  });

  describe('schedule', () => {
    it('should be able to schedule an appointment', async () => {
      const appointmentParams = generateScheduleAppointmentParams();
      const appointment = await service.schedule(appointmentParams);

      validateNewAppointmentEvent(appointmentParams.userId, appointment.id);

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

    it('should be able to schedule 2 appointments for the same user and member', async () => {
      const start = new Date(2030, 1, 1, 10);
      const end = new Date(2030, 1, 1, 12);

      const appointmentParamsBefore = generateScheduleAppointmentParams({
        start,
        end,
      });

      const resultBefore = await service.schedule(appointmentParamsBefore);
      expect(resultBefore.start).toEqual(start);
      expect(resultBefore.end).toEqual(end);
      validateNewAppointmentEvent(appointmentParamsBefore.userId, resultBefore.id);

      const newStart = new Date(start);
      newStart.setHours(15);
      const newEnd = new Date(end);
      newEnd.setHours(17);

      const appointmentParamsAfter = cloneDeep(appointmentParamsBefore);
      appointmentParamsAfter.start = newStart;
      appointmentParamsAfter.end = newEnd;

      const resultAfter = await service.schedule(appointmentParamsAfter);
      expect(spyOnEventEmitter).not.toBeCalled();
      expect(resultAfter.start).toEqual(newStart);
      expect(resultAfter.end).toEqual(newEnd);
      expect(resultAfter.link).toEqual(generateAppointmentLink(resultAfter.id));

      const appointment1 = await appointmentModel.find({
        _id: generateObjectId(resultBefore.id),
      });
      const appointment2 = await appointmentModel.find({
        _id: generateObjectId(resultAfter.id),
      });

      expect(appointment1).not.toBeUndefined();
      expect(appointment2).not.toBeUndefined();

      expect(appointment1).toEqual(appointment2);
    });
  });

  it('should override requested appointment on scheduled appointment', async () => {
    const requestAppointmentParams = generateRequestAppointmentParams();
    const { id } = await service.request(requestAppointmentParams);

    validateNewAppointmentEvent(requestAppointmentParams.userId, id);
    expect(id).not.toBeNull();

    const scheduleAppointmentParams = generateScheduleAppointmentParams({
      userId: requestAppointmentParams.userId,
      memberId: requestAppointmentParams.memberId,
    });

    const { id: scheduledId } = await service.schedule(scheduleAppointmentParams);

    expect(id).toEqual(scheduledId);
    expect(spyOnEventEmitter).not.toBeCalled();
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
      ${{ noShow: true, noShowReason }}     | ${{ noShow: true, noShowReason: faker.lorem.sentence(), notes: generateNotesParams() }}
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

        validateNewAppointmentEvent(appointmentParams.userId, appointment.id);

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

      expect(spyOnEventEmitter).toBeCalledWith(EventType.appointmentScoresUpdated, {
        memberId: generateObjectId(appointmentParams.memberId),
        scores: notes.scores,
      });

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

  const validateNewAppointmentEvent = (userId: string, appointmentId: string) => {
    expect(spyOnEventEmitter).toBeCalledWith(EventType.newAppointment, { appointmentId, userId });
    spyOnEventEmitter.mockReset();
  };
});
