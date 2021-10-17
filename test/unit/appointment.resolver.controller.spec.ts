import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import * as config from 'config';
import {
  AppointmentController,
  AppointmentMethod,
  AppointmentModule,
  AppointmentResolver,
  AppointmentScheduler,
  AppointmentService,
} from '../../src/appointment';
import {
  AppointmentStatus,
  EventType,
  IEventUpdatedAppointment,
  InternalNotificationType,
  InternalNotifyParams,
  ReminderType,
  UpdatedAppointmentAction,
} from '../../src/common';
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

      const eventParams: InternalNotifyParams = {
        memberId: params.memberId,
        userId: params.userId,
        type: InternalNotificationType.textToMember,
        metadata: {
          content: `${config
            .get('contents.appointmentRequest')
            .replace('@appLink@', appointment.link)}`,
        },
      };
      expect(spyOnEventEmitter).toBeCalledWith(EventType.internalNotify, eventParams);
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
    let spyOnSchedulerRegisterAppointmentAlert;
    let spyOnSchedulerDeleteTimeout;

    beforeEach(() => {
      spyOnServiceSchedule = jest.spyOn(service, 'schedule');
      spyOnSchedulerRegisterAppointmentAlert = jest.spyOn(scheduler, 'registerAppointmentAlert');
      spyOnSchedulerDeleteTimeout = jest.spyOn(scheduler, 'deleteTimeout');
    });

    afterEach(() => {
      spyOnServiceSchedule.mockReset();
      spyOnSchedulerRegisterAppointmentAlert.mockReset();
      spyOnEventEmitter.mockReset();
      spyOnSchedulerDeleteTimeout.mockReset();
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
      expect(spyOnSchedulerRegisterAppointmentAlert).toBeCalledWith({
        id: mockResult.id,
        memberId: appointment.memberId.toString(),
        userId: appointment.userId,
        start: appointment.start,
      });
      expect(spyOnSchedulerDeleteTimeout).toBeCalledWith({ id: appointment.memberId.toString() });
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

      const notifyParams: InternalNotifyParams = {
        userId: appointment.userId,
        type: InternalNotificationType.textSmsToUser,
        metadata: {
          content: `${config
            .get('contents.appointmentUser')
            .replace('@appointment.start@', appointment.start.toLocaleString())}`,
        },
      };
      expect(spyOnEventEmitter).toHaveBeenNthCalledWith(2, EventType.internalNotify, notifyParams);
      expect(spyOnSchedulerDeleteTimeout).toBeCalledWith({ id: appointment.memberId.toString() });
    });
  });

  describe('endAppointment', () => {
    let spyOnServiceEnd;
    let spyOnSchedulerDeleteTimeoutAlert;
    beforeEach(() => {
      spyOnServiceEnd = jest.spyOn(service, 'end');
      spyOnSchedulerDeleteTimeoutAlert = jest.spyOn(scheduler, 'deleteTimeout');
    });

    afterEach(() => {
      spyOnServiceEnd.mockReset();
      spyOnSchedulerDeleteTimeoutAlert.mockReset();
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
      expect(spyOnSchedulerDeleteTimeoutAlert).toHaveBeenNthCalledWith(1, {
        id: appointment.id + ReminderType.appointmentReminder,
      });
      expect(spyOnSchedulerDeleteTimeoutAlert).toHaveBeenNthCalledWith(2, {
        id: appointment.id + ReminderType.appointmentLongReminder,
      });
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
