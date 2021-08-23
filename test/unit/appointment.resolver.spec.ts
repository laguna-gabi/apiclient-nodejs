import { Test, TestingModule } from '@nestjs/testing';
import { DbModule } from '../../src/db/db.module';
import {
  AppointmentMethod,
  AppointmentModule,
  AppointmentResolver,
  AppointmentService,
  AppointmentStatus,
} from '../../src/appointment';
import {
  dbDisconnect,
  generateId,
  generateRequestAppointmentParams,
  generateScheduleAppointmentParams,
} from '../index';
import { EventEmitterModule } from '@nestjs/event-emitter';

describe('AppointmentResolver', () => {
  let module: TestingModule;
  let resolver: AppointmentResolver;
  let service: AppointmentService;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [DbModule, AppointmentModule, EventEmitterModule.forRoot()],
    }).compile();

    resolver = module.get<AppointmentResolver>(AppointmentResolver);
    service = module.get<AppointmentService>(AppointmentService);
  });

  afterAll(async () => {
    await module.close();
    await dbDisconnect();
  });

  describe('requestAppointment', () => {
    let spyOnServiceInsert;
    beforeEach(() => {
      spyOnServiceInsert = jest.spyOn(service, 'request');
    });

    afterEach(() => {
      spyOnServiceInsert.mockReset();
    });

    it('should create an appointment', async () => {
      const appointment = {
        ...generateRequestAppointmentParams(),
        status: AppointmentStatus.requested,
        method: AppointmentMethod.videoCall,
      };
      spyOnServiceInsert.mockImplementationOnce(async () => appointment);

      await resolver.requestAppointment(appointment);

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
        id: generateId(),
        ...generateRequestAppointmentParams(),
        method: AppointmentMethod.videoCall,
      };
      spyOnServiceGet.mockImplementationOnce(async () => appointment);

      const result = await resolver.getAppointment(appointment.id);

      expect(result).toEqual(appointment);
    });

    it('should fetch empty on a non existing appointment', async () => {
      spyOnServiceGet.mockImplementationOnce(async () => null);

      const result = await resolver.getAppointment(generateId());

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
      const status = AppointmentStatus.scheduled;
      const appointment = generateScheduleAppointmentParams();
      spyOnServiceSchedule.mockImplementationOnce(async () => ({
        ...appointment,
        status,
      }));

      const result = await resolver.scheduleAppointment(appointment);

      expect(result).toEqual({ ...appointment, status });
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
        id: generateId(),
        ...generateRequestAppointmentParams(),
        status: AppointmentStatus.done,
        method: AppointmentMethod.phoneCall,
      };
      spyOnServiceEnd.mockImplementationOnce(async () => appointment);

      const result = await resolver.endAppointment({ id: appointment.id });
      expect(spyOnServiceEnd).toBeCalledWith({ id: appointment.id });
      expect(result).toEqual(appointment);
    });
  });
});
