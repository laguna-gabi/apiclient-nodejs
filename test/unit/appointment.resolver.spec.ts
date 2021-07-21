import { Test, TestingModule } from '@nestjs/testing';
import { DbModule } from '../../src/db/db.module';
import { Types } from 'mongoose';
import {
  AppointmentMethod,
  AppointmentModule,
  AppointmentResolver,
  AppointmentService,
  AppointmentStatus,
} from '../../src/appointment';
import {
  dbDisconnect,
  generateNoShowAppointmentParams,
  generateNotesParams,
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
        id: new Types.ObjectId().toString(),
        ...generateRequestAppointmentParams(),
        method: AppointmentMethod.videoCall,
      };
      spyOnServiceGet.mockImplementationOnce(async () => appointment);

      const result = await resolver.getAppointment(appointment.id);

      expect(result).toEqual(appointment);
    });

    it('should fetch empty on a non existing appointment', async () => {
      spyOnServiceGet.mockImplementationOnce(async () => null);

      const result = await resolver.getAppointment(new Types.ObjectId().toString());

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
        id: new Types.ObjectId().toString(),
        ...generateRequestAppointmentParams(),
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
        id: new Types.ObjectId().toString(),
        ...generateRequestAppointmentParams(),
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
        ...generateRequestAppointmentParams(),
        status: AppointmentStatus.closed,
        method: AppointmentMethod.phoneCall,
      };
      spyOnServiceShow.mockImplementationOnce(async () => appointment);

      const result = await resolver.noShowAppointment(update);

      expect(result).toEqual(appointment);
    });
  });

  describe('setNotes', () => {
    let spyOnServiceSetNotes;
    beforeEach(() => {
      spyOnServiceSetNotes = jest.spyOn(service, 'setNotes');
    });

    afterEach(() => {
      spyOnServiceSetNotes.mockReset();
    });

    it('should set notes to an appointment', async () => {
      spyOnServiceSetNotes.mockImplementationOnce(async () => undefined);

      const result = await resolver.setNotes({
        appointmentId: Types.ObjectId().toString(),
        ...generateNotesParams(),
      });

      expect(result).toEqual(undefined);
    });
  });
});
