import { Test, TestingModule } from '@nestjs/testing';
import { DbModule } from '../../src/db/db.module';
import { model, Model, Types } from 'mongoose';
import {
  dbConnect,
  dbDisconnect,
  generateCreateAppointmentParams,
  generateNoShowAppointmentParams,
} from '../index';
import {
  Appointment,
  AppointmentDto,
  AppointmentMethod,
  AppointmentModule,
  AppointmentService,
  AppointmentStatus,
  NoShowParams,
} from '../../src/appointment';
import { User, UserDto } from '../../src/user';
import { Member, MemberDto } from '../../src/member';
import { Errors, ErrorType } from '../../src/common';
import * as faker from 'faker';

describe('AppointmentService', () => {
  let module: TestingModule;
  let service: AppointmentService;
  let userModel: Model<typeof UserDto>;
  let memberModel: Model<typeof MemberDto>;
  let appointmentModel: Model<typeof AppointmentDto>;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [DbModule, AppointmentModule],
    }).compile();

    service = module.get<AppointmentService>(AppointmentService);

    appointmentModel = model(Appointment.name, AppointmentDto);
    userModel = model(User.name, UserDto);
    memberModel = model(Member.name, MemberDto);

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
      const appointment = generateCreateAppointmentParams();
      const { id } = await service.insert(appointment);

      const result = await service.get(id);

      expect(result).toEqual(
        expect.objectContaining({
          _id: new Types.ObjectId(id),
          userId: new Types.ObjectId(appointment.userId),
          memberId: new Types.ObjectId(appointment.memberId),
          notBefore: appointment.notBefore,
          status: AppointmentStatus.requested,
        }),
      );
    });

    it('should return a scheduled appointment', async () => {
      const appointment = generateCreateAppointmentParams();
      const { id } = await service.insert(appointment);

      const start = new Date(2020, 10, 8, 5);
      const end = new Date(2020, 10, 8, 7);
      const method = AppointmentMethod.chat;

      const result = await service.schedule({
        id,
        method,
        start,
        end,
      });

      expect(result).toEqual(
        expect.objectContaining({
          _id: new Types.ObjectId(id),
          userId: new Types.ObjectId(appointment.userId),
          memberId: new Types.ObjectId(appointment.memberId),
          notBefore: appointment.notBefore,
          status: AppointmentStatus.scheduled,
          method,
          start,
          end,
        }),
      );
    });
  });

  describe('insert', () => {
    it('should insert a new appointment and validate all insert fields', async () => {
      const appointmentParams = generateCreateAppointmentParams();
      const result = await service.insert(appointmentParams);

      expect(result.id).not.toBeUndefined();

      const resultGet = await appointmentModel.findById(result.id);

      expect(resultGet).toEqual(
        expect.objectContaining({
          _id: new Types.ObjectId(result.id),
          userId: new Types.ObjectId(appointmentParams.userId),
          memberId: new Types.ObjectId(appointmentParams.memberId),
          notBefore: appointmentParams.notBefore,
          status: AppointmentStatus.requested,
        }),
      );
    });

    it('should updated an appointment notBefore for an existing memberId and userId', async () => {
      const memberId = new Types.ObjectId().toString();
      const userId = new Types.ObjectId().toString();

      const { id: id1, record: record1 } = await createAppointment({
        memberId,
        userId,
        notBeforeHours: 12,
      });

      const {
        notBefore,
        id: id2,
        record: record2,
      } = await createAppointment({
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
        }),
      );
    });

    it('should crate a new appointment for an existing memberId and different userId', async () => {
      const memberId = new Types.ObjectId().toString();
      const userId1 = new Types.ObjectId().toString();
      const userId2 = new Types.ObjectId().toString();

      const { id: id1, record: record1 } = await createAppointment({
        memberId,
        userId: userId1,
        notBeforeHours: 5,
      });

      const { id: id2, record: record2 } = await createAppointment({
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

      const { id: id1, record: record1 } = await createAppointment({
        memberId: memberId1,
        userId,
        notBeforeHours: 5,
      });

      const { id: id2, record: record2 } = await createAppointment({
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
      const params = generateCreateAppointmentParams();
      const { id } = await service.insert(params);

      const createdAppointment: any = await appointmentModel.findById(id);
      expect(createdAppointment.createdAt).toEqual(expect.any(Date));
      expect(createdAppointment.updatedAt).toEqual(expect.any(Date));
    });
  });

  describe('schedule', () => {
    it('should not be able to schedule a non existing appointment', async () => {
      const date = new Date();
      await expect(
        service.schedule({
          id: new Types.ObjectId().toString(),
          method: AppointmentMethod.chat,
          start: date,
          end: date,
        }),
      ).rejects.toThrow(Errors.get(ErrorType.appointmentIdNotFound));
    });

    it('should be able to schedule an existing appointment', async () => {
      const date = new Date();

      const appointment = await service.insert(
        generateCreateAppointmentParams(),
      );

      const result = await service.schedule({
        id: appointment.id,
        method: AppointmentMethod.phoneCall,
        start: date,
        end: date,
      });
      const resultGet = await appointmentModel.findById(result.id);

      expect(resultGet).toEqual(result);
    });

    it('should be able to re-schedule an existing scheduled appointment', async () => {
      const start = new Date(2030, 1, 1, 10);
      const end = new Date(2030, 1, 1, 12);

      const appointment = await service.insert(
        generateCreateAppointmentParams(),
      );

      const resultBefore = await service.schedule({
        id: appointment.id,
        method: AppointmentMethod.phoneCall,
        start,
        end,
      });

      expect(resultBefore.start).toEqual(start);
      expect(resultBefore.end).toEqual(end);

      const newStart = new Date(start);
      newStart.setHours(15);
      const newEnd = new Date(end);
      newEnd.setHours(17);

      const resultAfter = await service.schedule({
        id: appointment.id,
        method: AppointmentMethod.phoneCall,
        start: newStart,
        end: newEnd,
      });

      expect(resultAfter.start).toEqual(newStart);
      expect(resultAfter.end).toEqual(newEnd);
    });
  });

  describe('end', () => {
    it('should not be able to end a non existing appointment', async () => {
      await expect(
        service.end(new Types.ObjectId().toString()),
      ).rejects.toThrow(Errors.get(ErrorType.appointmentIdNotFound));
    });

    it('should be able to end an existing appointment', async () => {
      const appointment = await service.insert(
        generateCreateAppointmentParams(),
      );

      const endResult = await service.end(appointment.id);
      expect(endResult.status).toEqual(AppointmentStatus.done);
    });

    it('should be able to end an existing scheduled appointment', async () => {
      const date = new Date();

      const appointment = await service.insert(
        generateCreateAppointmentParams(),
      );

      await service.schedule({
        id: appointment.id,
        method: AppointmentMethod.phoneCall,
        start: date,
        end: date,
      });

      const endResult = await service.end(appointment.id);
      expect(endResult.status).toEqual(AppointmentStatus.done);
    });
  });

  describe('freeze', () => {
    it('should not be able to end a non existing appointment', async () => {
      await expect(
        service.end(new Types.ObjectId().toString()),
      ).rejects.toThrow(Errors.get(ErrorType.appointmentIdNotFound));
    });

    it('should be able to end an existing appointment', async () => {
      const appointment = await service.insert(
        generateCreateAppointmentParams(),
      );

      const endResult = await service.freeze(appointment.id);
      expect(endResult.status).toEqual(AppointmentStatus.closed);
    });

    it('should be able to freeze an existing scheduled appointment', async () => {
      const date = new Date();

      const appointment = await service.insert(
        generateCreateAppointmentParams(),
      );

      await service.schedule({
        id: appointment.id,
        method: AppointmentMethod.phoneCall,
        start: date,
        end: date,
      });

      const endResult = await service.freeze(appointment.id);
      expect(endResult.status).toEqual(AppointmentStatus.closed);
    });
  });

  describe('show', () => {
    const reason = faker.lorem.sentence();

    it('should not be able to update show to a non existing appointment', async () => {
      await expect(
        service.show(generateNoShowAppointmentParams()),
      ).rejects.toThrow(Errors.get(ErrorType.appointmentIdNotFound));
    });

    test.each`
      update
      ${{ noShow: true, reason }}
      ${{ noShow: false, reason: null }}
    `(
      `should be able to update appointment show $update to an existing appointment`,
      async (params) => {
        const appointment = await service.insert(
          generateCreateAppointmentParams(),
        );

        const updateShowParams: NoShowParams = {
          id: appointment.id,
          ...params.update,
        };

        const result = await service.show(updateShowParams);
        expect(updateShowParams).toEqual(
          expect.objectContaining(result.noShow),
        );
      },
    );

    test.each`
      update1                                             | update2
      ${{ noShow: true, reason: faker.lorem.sentence() }} | ${{ noShow: true, reason }}
      ${{ noShow: false }}                                | ${{ noShow: true, reason }}
      ${{ noShow: true, reason }}                         | ${{ noShow: false, reason: null }}
    `(
      `should be able to multiple update appointment show $update1 and $update2 to an existing appointment`,
      async (params) => {
        const appointment = await service.insert(
          generateCreateAppointmentParams(),
        );

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

  const createAppointment = async ({
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

    const appointmentParams = generateCreateAppointmentParams({
      memberId,
      userId,
      notBefore,
    });

    const result = await service.insert(appointmentParams);
    expect(result.id).not.toBeUndefined();

    const record: any = await appointmentModel.findById(result.id);
    return { notBefore, id: result.id, record };
  };
});
