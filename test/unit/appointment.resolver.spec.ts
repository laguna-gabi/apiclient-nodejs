import { Test, TestingModule } from '@nestjs/testing';
import { DbModule } from '../../src/db/db.module';
import { ObjectID } from 'bson';
import {
  AppointmentMethod,
  AppointmentModule,
  AppointmentResolver,
  AppointmentService,
  AppointmentStatus,
} from '../../src/appointment';
import {
  dbDisconnect,
  generateCreateAppointmentParams,
  generateNoShowAppointmentParams,
} from '../index';

describe('AppointmentResolver', () => {
  let module: TestingModule;
  let resolver: AppointmentResolver;
  let service: AppointmentService;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [DbModule, AppointmentModule],
    }).compile();

    resolver = module.get<AppointmentResolver>(AppointmentResolver);
    service = module.get<AppointmentService>(AppointmentService);
  });

  afterAll(async () => {
    await module.close();
    await dbDisconnect();
  });

  describe('createAppointment', () => {
    let spyOnServiceInsert;
    beforeEach(() => {
      spyOnServiceInsert = jest.spyOn(service, 'insert');
    });

    afterEach(() => {
      spyOnServiceInsert.mockReset();
    });

    it('should create an appointment', async () => {
      const appointment = {
        ...generateCreateAppointmentParams(),
        status: AppointmentStatus.requested,
        method: AppointmentMethod.videoCall,
      };
      spyOnServiceInsert.mockImplementationOnce(async () => appointment);

      await resolver.createAppointment(appointment);

      expect(spyOnServiceInsert).toBeCalledTimes(1);
      expect(spyOnServiceInsert).toBeCalledWith(appointment);
    });
  });

  describe('getAppointment', () => {
    let spyOnServiceGet;
    beforeEach(() => {
      spyOnServiceGet = jest.spyOn(service, 'get');
    });

    afterEach(() => {
      spyOnServiceGet.mockReset();
    });

    it('should get an appointment for a given id', async () => {
      const appointment = {
        id: new ObjectID().toString(),
        ...generateCreateAppointmentParams(),
        method: AppointmentMethod.videoCall,
      };
      spyOnServiceGet.mockImplementationOnce(async () => appointment);

      const result = await resolver.getAppointment(appointment.id);

      expect(result).toEqual(appointment);
    });

    it('should fetch empty on a non existing appointment', async () => {
      spyOnServiceGet.mockImplementationOnce(async () => null);

      const result = await resolver.getAppointment(new ObjectID().toString());

      expect(result).toBeNull();
    });
  });

  describe('scheduleAppointment', () => {
    let spyOnServiceSchedule;
    beforeEach(() => {
      spyOnServiceSchedule = jest.spyOn(service, 'schedule');
    });

    afterEach(() => {
      spyOnServiceSchedule.mockReset();
    });

    it('should schedule an existing appointment for a given id', async () => {
      const appointment = {
        id: new ObjectID().toString(),
        ...generateCreateAppointmentParams(),
        status: AppointmentStatus.requested,
        method: AppointmentMethod.phoneCall,
      };
      spyOnServiceSchedule.mockImplementationOnce(async () => appointment);

      const result = await resolver.scheduleAppointment({
        id: appointment.id,
        method: AppointmentMethod.phoneCall,
        start: new Date(),
        end: new Date(),
      });

      expect(result).toEqual(appointment);
    });
  });

  describe('endAppointment', () => {
    let spyOnServiceEnd;
    beforeEach(() => {
      spyOnServiceEnd = jest.spyOn(service, 'end');
    });

    afterEach(() => {
      spyOnServiceEnd.mockReset();
    });

    it('should end an existing appointment for a given id', async () => {
      const appointment = {
        id: new ObjectID().toString(),
        ...generateCreateAppointmentParams(),
        status: AppointmentStatus.done,
        method: AppointmentMethod.phoneCall,
      };
      spyOnServiceEnd.mockImplementationOnce(async () => appointment);

      const result = await resolver.endAppointment(appointment.id);

      expect(result).toEqual(appointment);
    });
  });

  describe('freezeAppointment', () => {
    let spyOnServiceFreeze;
    beforeEach(() => {
      spyOnServiceFreeze = jest.spyOn(service, 'freeze');
    });

    afterEach(() => {
      spyOnServiceFreeze.mockReset();
    });

    it('should freeze an existing appointment for a given id', async () => {
      const appointment = {
        id: new ObjectID().toString(),
        ...generateCreateAppointmentParams(),
        status: AppointmentStatus.closed,
        method: AppointmentMethod.phoneCall,
      };
      spyOnServiceFreeze.mockImplementationOnce(async () => appointment);

      const result = await resolver.freezeAppointment(appointment.id);

      expect(result).toEqual(appointment);
    });
  });

  describe('showAppointment', () => {
    let spyOnServiceShow;
    beforeEach(() => {
      spyOnServiceShow = jest.spyOn(service, 'show');
    });

    afterEach(() => {
      spyOnServiceShow.mockReset();
    });

    it('should update show on an existing appointment for a given id', async () => {
      const update = generateNoShowAppointmentParams();

      const appointment = {
        ...update,
        ...generateCreateAppointmentParams(),
        status: AppointmentStatus.closed,
        method: AppointmentMethod.phoneCall,
      };
      spyOnServiceShow.mockImplementationOnce(async () => appointment);

      const result = await resolver.noShowAppointment(update);

      expect(result).toEqual(appointment);
    });
  });
});
