import { Test, TestingModule } from '@nestjs/testing';
import { DbModule } from '../../src/db/db.module';
import { model, Model, Types } from 'mongoose';
import {
  dbConnect,
  dbDisconnect,
  generateNoShowAppointmentParams,
  generateNotesParams,
  generateRequestAppointmentParams,
  generateScheduleAppointmentParams,
} from '../index';
import {
  Appointment,
  AppointmentDto,
  AppointmentModule,
  AppointmentService,
  AppointmentStatus,
  NoShowParams,
  SetNotesParams,
} from '../../src/appointment';
import { Errors, ErrorType, EventType } from '../../src/common';
import * as faker from 'faker';
import { EventEmitter2, EventEmitterModule } from '@nestjs/event-emitter';
import { cloneDeep } from 'lodash';

describe('AppointmentService', () => {
  let module: TestingModule;
  let service: AppointmentService;
  let eventEmitter: EventEmitter2;
  let appointmentModel: Model<typeof AppointmentDto>;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [DbModule, AppointmentModule, EventEmitterModule.forRoot()],
    }).compile();

    service = module.get<AppointmentService>(AppointmentService);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);

    appointmentModel = model(Appointment.name, AppointmentDto);

    await dbConnect();
  });

  afterAll(async () => {
    await module.close();
    await dbDisconnect();
  });

  describe('get', () => {
    it('should return null for non existing appointment', async () => {
      const id = new Types.ObjectId();
      const result = await service.get(id.toString());
      expect(result).toBeNull();
    });

    it('should return appointment set up for a user and member', async () => {
      const appointment = generateRequestAppointmentParams();
      const { id } = await service.request(appointment);

      const result = await service.get(id);

      expect(result).toEqual(
        expect.objectContaining({
          _id: new Types.ObjectId(id),
          userId: new Types.ObjectId(appointment.userId),
          memberId: new Types.ObjectId(appointment.memberId),
          notBefore: appointment.notBefore,
          status: AppointmentStatus.requested,
          updatedAt: expect.any(Date),
        }),
      );
    });

    it('should return a scheduled appointment', async () => {
      const appointment = generateScheduleAppointmentParams();
      const { id } = await service.schedule(appointment);

      const result = await service.get(id);
      expect(result.status).toEqual(AppointmentStatus.scheduled);
    });
  });

  describe('insert', () => {
    it('should insert a new appointment and validate all insert fields', async () => {
      const appointmentParams = generateRequestAppointmentParams();
      const result = await service.request(appointmentParams);

      expect(result.id).not.toBeUndefined();

      const resultGet = await appointmentModel.findById(result.id);

      expect(resultGet).toEqual(
        expect.objectContaining({
          _id: new Types.ObjectId(result.id),
          userId: new Types.ObjectId(appointmentParams.userId),
          memberId: new Types.ObjectId(appointmentParams.memberId),
          notBefore: appointmentParams.notBefore,
          status: AppointmentStatus.requested,
          updatedAt: expect.any(Date),
        }),
      );
    });

    it('should updated an appointment notBefore for an existing memberId and userId', async () => {
      const memberId = new Types.ObjectId().toString();
      const userId = new Types.ObjectId().toString();

      const { id: id1, record: record1 } = await requestAppointment({
        memberId,
        userId,
        notBeforeHours: 12,
      });

      const {
        notBefore,
        id: id2,
        record: record2,
      } = await requestAppointment({
        memberId,
        userId,
        notBeforeHours: 8,
      });

      expect(id1).toEqual(id2);

      expect(record2).toEqual(
        expect.objectContaining({
          id: record1.id,
          userId: new Types.ObjectId(userId),
          memberId: new Types.ObjectId(memberId),
          notBefore,
          status: AppointmentStatus.requested,
          updatedAt: expect.any(Date),
        }),
      );
    });

    it('should crate a new appointment for an existing memberId and different userId', async () => {
      const memberId = new Types.ObjectId().toString();
      const userId1 = new Types.ObjectId().toString();
      const userId2 = new Types.ObjectId().toString();

      const { id: id1, record: record1 } = await requestAppointment({
        memberId,
        userId: userId1,
        notBeforeHours: 5,
      });

      const { id: id2, record: record2 } = await requestAppointment({
        memberId,
        userId: userId2,
        notBeforeHours: 2,
      });

      expect(id1).not.toEqual(id2);
      expect(record1.memberId).toEqual(record2.memberId);
      expect(record1.status).toEqual(record2.status);
      expect(record1.createdAt).not.toEqual(record2.createdAt);
      expect(record1.userId).not.toEqual(record2.userId);
      expect(record1.notBefore).not.toEqual(record2.notBefore);
      expect(record1.updatedAt).not.toEqual(record2.updatedAt);
    });

    it('should crate a new appointment for an existing userId and different memberId', async () => {
      const memberId1 = new Types.ObjectId().toString();
      const memberId2 = new Types.ObjectId().toString();
      const userId = new Types.ObjectId().toString();

      const { id: id1, record: record1 } = await requestAppointment({
        memberId: memberId1,
        userId,
        notBeforeHours: 5,
      });

      const { id: id2, record: record2 } = await requestAppointment({
        memberId: memberId2,
        userId,
        notBeforeHours: 2,
      });

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

      const createdAppointment: any = await appointmentModel.findById(id);
      expect(createdAppointment.createdAt).toEqual(expect.any(Date));
      expect(createdAppointment.updatedAt).toEqual(expect.any(Date));
    });

    it('should validate that on inserted new appointment, an internal event is sent', async () => {
      const params = generateRequestAppointmentParams();
      const spyOnEventEmitter = jest.spyOn(eventEmitter, 'emit');
      const { id } = await service.request(params);

      expect(spyOnEventEmitter).toBeCalledWith(EventType.newAppointment, {
        appointmentId: new Types.ObjectId(id),
        userId: new Types.ObjectId(params.userId),
      });

      spyOnEventEmitter.mockReset();
    });

    it('should validate that on updated appointment, an internal event is NOT sent', async () => {
      const params = generateRequestAppointmentParams();
      const spyOnEventEmitter = jest.spyOn(eventEmitter, 'emit');

      await service.request(params);
      expect(spyOnEventEmitter).toBeCalled();
      spyOnEventEmitter.mockReset();

      await service.request(params);
      expect(spyOnEventEmitter).not.toBeCalled();
      spyOnEventEmitter.mockReset();
    });

    it('should create a new request appointment on exising scheduled', async () => {
      const memberId = new Types.ObjectId().toString();
      const userId = new Types.ObjectId().toString();
      const scheduleParams = generateScheduleAppointmentParams({ userId, memberId });
      const requestParams = generateRequestAppointmentParams({ userId, memberId });
      const scheduleAppointment = await service.schedule(scheduleParams);
      const requestAppointment = await service.request(requestParams);

      expect(scheduleAppointment.id).not.toEqual(requestAppointment.id);
    });
  });

  describe('schedule', () => {
    it('should be able to schedule an appointment', async () => {
      const appointmentParams = generateScheduleAppointmentParams();
      const appointment = await service.schedule(appointmentParams);

      expect(appointment).toEqual(
        expect.objectContaining({
          id: expect.any(Types.ObjectId),
          method: appointmentParams.method,
          notBefore: appointmentParams.notBefore,
          status: AppointmentStatus.scheduled,
          updatedAt: expect.any(Date),
        }),
      );
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

      const newStart = new Date(start);
      newStart.setHours(15);
      const newEnd = new Date(end);
      newEnd.setHours(17);

      const appointmentParamsAfter = cloneDeep(appointmentParamsBefore);
      appointmentParamsAfter.start = newStart;
      appointmentParamsAfter.end = newEnd;

      const resultAfter = await service.schedule(appointmentParamsAfter);

      expect(resultAfter.start).toEqual(newStart);
      expect(resultAfter.end).toEqual(newEnd);

      const appointment1 = await appointmentModel.find({
        _id: new Types.ObjectId(resultBefore.id),
      });
      const appointment2 = await appointmentModel.find({
        _id: new Types.ObjectId(resultAfter.id),
      });

      expect(appointment1).not.toBeUndefined();
      expect(appointment2).not.toBeUndefined();
    });
  });

  describe('end', () => {
    it('should not be able to end a non existing appointment', async () => {
      await expect(service.end(new Types.ObjectId().toString())).rejects.toThrow(
        Errors.get(ErrorType.appointmentIdNotFound),
      );
    });

    it('should be able to end an existing appointment', async () => {
      const appointment = await service.request(generateRequestAppointmentParams());

      const endResult = await service.end(appointment.id);
      expect(endResult.status).toEqual(AppointmentStatus.done);
    });

    it('should be able to end an existing scheduled appointment', async () => {
      const appointmentParams = generateScheduleAppointmentParams();

      const appointment = await service.schedule(appointmentParams);

      const endResult = await service.end(appointment.id);
      expect(endResult.status).toEqual(AppointmentStatus.done);
    });
  });

  describe('freeze', () => {
    it('should not be able to end a non existing appointment', async () => {
      await expect(service.end(new Types.ObjectId().toString())).rejects.toThrow(
        Errors.get(ErrorType.appointmentIdNotFound),
      );
    });

    it('should be able to end an existing appointment', async () => {
      const appointment = await service.request(generateRequestAppointmentParams());

      const endResult = await service.freeze(appointment.id);
      expect(endResult.status).toEqual(AppointmentStatus.closed);
    });

    it('should be able to freeze an existing scheduled appointment', async () => {
      const appointmentParams = generateScheduleAppointmentParams();

      const appointment = await service.schedule(appointmentParams);

      const endResult = await service.freeze(appointment.id);
      expect(endResult.status).toEqual(AppointmentStatus.closed);
    });
  });

  describe('show', () => {
    const reason = faker.lorem.sentence();

    it('should not be able to update show to a non existing appointment', async () => {
      await expect(service.show(generateNoShowAppointmentParams())).rejects.toThrow(
        Errors.get(ErrorType.appointmentIdNotFound),
      );
    });

    test.each`
      update
      ${{ noShow: true, reason }}
      ${{ noShow: false, reason: null }}
    `(
      `should be able to update appointment show $update to an existing appointment`,
      async (params) => {
        const appointment = await service.request(generateRequestAppointmentParams());

        const updateShowParams: NoShowParams = {
          id: appointment.id,
          ...params.update,
        };

        const result = await service.show(updateShowParams);
        expect(updateShowParams).toEqual(expect.objectContaining(result.noShow));
      },
    );

    test.each`
      update1                                             | update2
      ${{ noShow: true, reason: faker.lorem.sentence() }} | ${{ noShow: true, reason }}
      ${{ noShow: false }}                                | ${{ noShow: true, reason }}
      ${{ noShow: true, reason }}                         | ${{ noShow: false, reason: null }}
    `(
      `should be able to multiple update existing appointment : $update1 and $update2`,
      async (params) => {
        const appointment = await service.request(generateRequestAppointmentParams());

        const updateShowParams1: NoShowParams = {
          id: appointment.id,
          ...params.update1,
        };
        await service.show(updateShowParams1);

        const updateShowParams2: NoShowParams = {
          id: appointment.id,
          ...params.update2,
        };
        const result = await service.show(updateShowParams2);
        expect(result.noShow).toEqual(params.update2);
      },
    );
  });

  describe('setNotes', () => {
    it('should set new notes to an appointment', async () => {
      const resultAppointment = await service.schedule(generateScheduleAppointmentParams());

      const notes = generateNotesParams();
      await service.setNotes({ appointmentId: resultAppointment.id, ...notes });

      const result = await service.get(resultAppointment.id);
      expect(result.notes.notes[0].key).toEqual(notes.notes[0].key);
      expect(result.notes.notes[0].value).toEqual(notes.notes[0].value);
      expect(result.notes.scores).toEqual(expect.objectContaining(notes.scores));
    });

    it('should re-set notes and scores to an appointment', async () => {
      const resultAppointment = await service.schedule(generateScheduleAppointmentParams());

      const notes1 = generateNotesParams();
      await service.setNotes({ appointmentId: resultAppointment.id, ...notes1 });

      const notes2 = generateNotesParams(2);
      await service.setNotes({ appointmentId: resultAppointment.id, ...notes2 });

      const result = await service.get(resultAppointment.id);
      expect(result.notes.notes[0].key).toEqual(notes2.notes[0].key);
      expect(result.notes.notes[0].value).toEqual(notes2.notes[0].value);
      expect(result.notes.notes[1].key).toEqual(notes2.notes[1].key);
      expect(result.notes.notes[1].value).toEqual(notes2.notes[1].value);
      expect(result.notes.scores).toEqual(expect.objectContaining(notes2.scores));
    });

    it('should throw error on missing appointmentId', async () => {
      await expect(
        service.setNotes({
          appointmentId: new Types.ObjectId().toString(),
          ...generateNotesParams(),
        }),
      ).rejects.toThrow(Errors.get(ErrorType.appointmentIdNotFound));
    });

    it('should validate that on insert notes, an internal event is sent', async () => {
      const appointmentParams = generateScheduleAppointmentParams();
      const resultAppointment = await service.schedule(appointmentParams);

      const spyOnEventEmitter = jest.spyOn(eventEmitter, 'emit');
      const setNotesParams: SetNotesParams = {
        appointmentId: resultAppointment.id,
        ...generateNotesParams(),
      };
      await service.setNotes(setNotesParams);

      expect(spyOnEventEmitter).toBeCalledWith(EventType.appointmentScoresUpdated, {
        memberId: new Types.ObjectId(appointmentParams.memberId),
        scores: setNotesParams.scores,
      });

      spyOnEventEmitter.mockReset();
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
});
