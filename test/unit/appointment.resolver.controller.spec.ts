import { Test, TestingModule } from '@nestjs/testing';
import {
  AppointmentController,
  AppointmentMethod,
  AppointmentModule,
  AppointmentResolver,
  AppointmentScheduler,
  AppointmentService,
} from '../../src/appointment';
import {
  dbDisconnect,
  defaultModules,
  generateAppointmentLink,
  generateId,
  generateNotesParams,
  generateRequestAppointmentParams,
  generateScheduleAppointmentParams,
  generateUpdateNotesParams,
} from '../index';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  AppointmentStatus,
  EventType,
  IEventUpdatedAppointment,
  NotificationType,
  UpdatedAppointmentAction,
} from '../../src/common';
import { NotifyParams } from '../../src/member';
import * as config from 'config';

describe('AppointmentResolver', () => {
  let module: TestingModule;
  let resolver: AppointmentResolver;
  let controller: AppointmentController;
  let service: AppointmentService;
  let scheduler: AppointmentScheduler;
  let eventEmitter: EventEmitter2;
  let spyOnEventEmitter;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: defaultModules().concat(AppointmentModule),
    }).compile();

    resolver = module.get<AppointmentResolver>(AppointmentResolver);
    controller = module.get<AppointmentController>(AppointmentController);
    service = module.get<AppointmentService>(AppointmentService);
    scheduler = module.get<AppointmentScheduler>(AppointmentScheduler);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
    spyOnEventEmitter = jest.spyOn(eventEmitter, 'emit');
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
      spyOnEventEmitter.mockReset();
    });

    it('should create an appointment', async () => {
      const params = generateRequestAppointmentParams();
      const id = generateId();
      const appointment = {
        ...params,
        id,
        status: AppointmentStatus.requested,
        method: AppointmentMethod.videoCall,
        link: generateAppointmentLink(id),
      };
      spyOnServiceInsert.mockImplementationOnce(async () => appointment);

      await resolver.requestAppointment(appointment);

      expect(spyOnServiceInsert).toBeCalledTimes(1);
      expect(spyOnServiceInsert).toBeCalledWith(appointment);

      const eventParams: NotifyParams = {
        memberId: params.memberId,
        userId: params.userId,
        type: NotificationType.text,
        metadata: {
          content: `${config
            .get('contents.appointmentRequest')
            .replace('@appLink@', appointment.link)}`,
        },
      };
      expect(spyOnEventEmitter).toBeCalledWith(EventType.notify, eventParams);
    });
  });

  describe('getAppointment', () => {
    let spyOnServiceGet;
    beforeEach(() => {
      spyOnServiceGet = jest.spyOn(service, 'get');
    });

    afterEach(() => {
      spyOnServiceGet.mockReset();
      spyOnEventEmitter.mockReset();
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
    let spyOnSchedulerUpdateAppointmentAlert;
    beforeEach(() => {
      spyOnServiceSchedule = jest.spyOn(service, 'schedule');
      spyOnSchedulerUpdateAppointmentAlert = jest.spyOn(scheduler, 'updateAppointmentAlert');
    });

    afterEach(() => {
      spyOnServiceSchedule.mockReset();
      spyOnSchedulerUpdateAppointmentAlert.mockReset();
      spyOnEventEmitter.mockReset();
    });

    test.each`
      type            | method
      ${'resolver'}   | ${async (appointment) => await resolver.scheduleAppointment(appointment)}
      ${'controller'} | ${async (appointment) => await controller.scheduleAppointment(appointment)}
    `(`should get an appointment via $type for a given id`, async (params) => {
      const appointment = generateScheduleAppointmentParams();
      const mockResult = { ...appointment, status: AppointmentStatus.scheduled, id: generateId() };
      spyOnServiceSchedule.mockImplementationOnce(async () => mockResult);

      const result = await params.method(appointment);

      expect(result).toEqual(mockResult);
      expect(spyOnSchedulerUpdateAppointmentAlert).toBeCalledWith({
        id: mockResult.id,
        memberId: appointment.memberId.toString(),
        userId: appointment.userId,
        start: appointment.start,
      });
    });

    it('should validate that on schedule appointment, internal events are sent', async () => {
      const status = AppointmentStatus.scheduled;
      const appointment = generateScheduleAppointmentParams();
      spyOnServiceSchedule.mockImplementationOnce(async () => ({
        ...appointment,
        status,
      }));

      const result = await resolver.scheduleAppointment(appointment);
      const eventParams: IEventUpdatedAppointment = {
        updatedAppointmentAction: UpdatedAppointmentAction.edit,
        memberId: result.memberId.toString(),
        userId: result.userId,
        key: result.id,
        value: {
          status: result.status,
          start: result.start,
        },
      };
      expect(spyOnEventEmitter).toHaveBeenNthCalledWith(
        1,
        EventType.updatedAppointment,
        eventParams,
      );

      const notifyParams: NotifyParams = {
        memberId: '',
        userId: appointment.userId,
        type: NotificationType.textSms,
        metadata: {
          content: `${config
            .get('contents.appointmentUser')
            .replace('@appointment.start@', appointment.start.toLocaleString())}`,
        },
      };
      expect(spyOnEventEmitter).toHaveBeenNthCalledWith(2, EventType.notify, notifyParams);
    });
  });

  describe('endAppointment', () => {
    let spyOnServiceEnd;
    let spyOnSchedulerDeleteAppointmentAlert;
    beforeEach(() => {
      spyOnServiceEnd = jest.spyOn(service, 'end');
      spyOnSchedulerDeleteAppointmentAlert = jest.spyOn(scheduler, 'deleteAppointmentAlert');
    });

    afterEach(() => {
      spyOnServiceEnd.mockReset();
      spyOnSchedulerDeleteAppointmentAlert.mockReset();
      spyOnEventEmitter.mockReset();
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
      expect(spyOnSchedulerDeleteAppointmentAlert).toBeCalledWith({ id: appointment.id });
      expect(result).toEqual(appointment);
    });

    it('should validate that on end appointment, an internal event is sent', async () => {
      const appointment = {
        id: generateId(),
        ...generateRequestAppointmentParams(),
        status: AppointmentStatus.done,
        method: AppointmentMethod.phoneCall,
      };
      spyOnServiceEnd.mockImplementationOnce(async () => appointment);

      const result = await resolver.endAppointment({ id: generateId() });
      const eventParams: IEventUpdatedAppointment = {
        updatedAppointmentAction: UpdatedAppointmentAction.delete,
        memberId: result.memberId.toString(),
        userId: result.userId,
        key: result.id,
      };
      expect(spyOnEventEmitter).toBeCalledWith(EventType.updatedAppointment, eventParams);
    });
  });

  describe('updateNotes', () => {
    let spyOnServiceUpdateNotes;
    beforeEach(() => {
      spyOnServiceUpdateNotes = jest.spyOn(service, 'updateNotes');
    });

    afterEach(() => {
      spyOnServiceUpdateNotes.mockReset();
      spyOnEventEmitter.mockReset();
    });

    it('should update the notes of given appointment id', async () => {
      const notes = generateNotesParams();
      const notesParams = generateUpdateNotesParams({ notes });

      spyOnServiceUpdateNotes.mockImplementationOnce(async () => notes);

      const result = await resolver.updateNotes(notesParams);
      expect(spyOnServiceUpdateNotes).toBeCalledWith(notesParams);
      expect(result).toEqual(notes);
    });
  });
});
