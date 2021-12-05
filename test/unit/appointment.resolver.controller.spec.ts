import { ContentKey, InternalNotificationType } from '@lagunahealth/pandora';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { addMinutes } from 'date-fns';
import {
  AppointmentController,
  AppointmentMethod,
  AppointmentModule,
  AppointmentResolver,
  AppointmentScheduler,
  AppointmentService,
  ScheduleAppointmentParams,
} from '../../src/appointment';
import {
  AppointmentStatus,
  ErrorType,
  Errors,
  EventType,
  IEventOnUpdatedAppointment,
  IEventOnUpdatedUserCommunication,
  InternalNotifyParams,
  Logger,
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
  mockLogger,
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
    mockLogger(module.get<Logger>(Logger));
  });

  afterAll(async () => {
    await module.close();
    await dbDisconnect();
  });

  describe('requestAppointment', () => {
    let spyOnServiceInsert;
    let spyOnServiceGet;
    beforeEach(() => {
      spyOnServiceInsert = jest.spyOn(service, 'request');
      spyOnServiceGet = jest.spyOn(service, 'get');
    });

    afterEach(() => {
      spyOnServiceInsert.mockReset();
      spyOnServiceGet.mockReset();
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
          contentType: ContentKey.appointmentRequest,
          scheduleLink: `${appointment.link}`,
          path: `connect/${appointment.id}`,
        },
      };
      expect(spyOnEventEmitter).toBeCalledWith(EventType.notifyInternal, eventParams);
    });

    it('should not notify user & member for past appointments', async () => {
      const spyOnSchedulerRegisterAppointmentAlert = jest.spyOn(
        scheduler,
        'registerAppointmentAlert',
      );
      const appointment = generateScheduleAppointmentParams({
        start: addMinutes(new Date(), -10),
        end: addMinutes(new Date(), 20),
      });
      spyOnServiceInsert.mockImplementationOnce(async () => appointment);
      spyOnServiceGet.mockImplementationOnce(async () => undefined);

      await resolver.scheduleAppointment(appointment);
      expect(spyOnSchedulerRegisterAppointmentAlert).not.toBeCalled();
      expect(spyOnEventEmitter).not.toHaveBeenCalledWith(
        EventType.notifyInternal,
        expect.anything(),
      );
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
    let spyOnServiceGet;
    let spyOnSchedulerRegisterAppointmentAlert;
    let spyOnSchedulerDeleteTimeout;

    beforeEach(() => {
      spyOnServiceSchedule = jest.spyOn(service, 'schedule');
      spyOnServiceGet = jest.spyOn(service, 'get');
      spyOnSchedulerRegisterAppointmentAlert = jest.spyOn(scheduler, 'registerAppointmentAlert');
      spyOnSchedulerDeleteTimeout = jest.spyOn(scheduler, 'deleteTimeout');
    });

    afterEach(() => {
      spyOnServiceSchedule.mockReset();
      spyOnServiceGet.mockReset();
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
      spyOnServiceGet.mockImplementationOnce(async () => undefined);

      const result = await params.method(appointment);

      expect(result).toEqual(mockResult);
      expect(spyOnSchedulerRegisterAppointmentAlert).toBeCalledWith({
        id: mockResult.id,
        memberId: appointment.memberId.toString(),
        userId: appointment.userId.toString(),
        start: appointment.start,
      });
      expect(spyOnSchedulerDeleteTimeout).toBeCalledWith({ id: appointment.memberId.toString() });
    });

    it(`should not allow editing appointment on status=${AppointmentStatus.done}`, async () => {
      const appointment = generateScheduleAppointmentParams();
      const mockResult = { ...appointment, status: AppointmentStatus.scheduled, id: generateId() };
      spyOnServiceSchedule.mockImplementationOnce(async () => mockResult);

      const result = await resolver.scheduleAppointment(appointment);
      expect(result).toEqual(mockResult);

      const updatedApp: ScheduleAppointmentParams = { ...mockResult, start: new Date() };

      spyOnServiceGet.mockImplementationOnce(async () => ({
        ...result,
        status: AppointmentStatus.done,
      }));
      await expect(resolver.scheduleAppointment(updatedApp)).rejects.toThrow(
        Errors.get(ErrorType.appointmentCanNotBeUpdated),
      );
    });

    it(`should allow editing ${AppointmentStatus.scheduled} appointment`, async () => {
      const appointment = generateScheduleAppointmentParams();
      const mockResult = { ...appointment, status: AppointmentStatus.scheduled, id: generateId() };
      spyOnServiceSchedule.mockImplementationOnce(async () => mockResult);
      spyOnServiceGet.mockImplementationOnce(async () => undefined);

      const result = await resolver.scheduleAppointment(appointment);
      expect(result).toEqual(mockResult);

      const updatedApp: ScheduleAppointmentParams = { ...mockResult, start: new Date() };
      spyOnServiceSchedule.mockImplementationOnce(async () => updatedApp);
      spyOnServiceGet.mockImplementationOnce(async () => updatedApp);
      const resultUpdate = await resolver.scheduleAppointment(appointment);
      expect(resultUpdate).toEqual(updatedApp);
    });

    it('should validate that on schedule appointment, internal events are sent', async () => {
      const status = AppointmentStatus.scheduled;
      const appointment = generateScheduleAppointmentParams();
      spyOnServiceSchedule.mockImplementationOnce(async () => ({
        ...appointment,
        status,
      }));
      spyOnServiceGet.mockImplementationOnce(async () => undefined);

      const result = await resolver.scheduleAppointment(appointment);
      const eventParams: IEventOnUpdatedAppointment = {
        updatedAppointmentAction: UpdatedAppointmentAction.edit,
        memberId: result.memberId.toString(),
        userId: result.userId.toString(),
        key: result.id,
        value: {
          status: result.status,
          start: result.start,
        },
      };
      expect(spyOnEventEmitter).toHaveBeenNthCalledWith(
        1,
        EventType.onUpdatedAppointment,
        eventParams,
      );

      const notifyUserParams: InternalNotifyParams = {
        memberId: appointment.memberId,
        userId: appointment.userId,
        type: InternalNotificationType.textSmsToUser,
        metadata: {
          contentType: ContentKey.appointmentScheduledUser,
          appointmentTime: appointment.start,
        },
      };
      expect(spyOnEventEmitter).toHaveBeenNthCalledWith(
        2,
        EventType.notifyInternal,
        notifyUserParams,
      );

      const notifyMemberParams: InternalNotifyParams = {
        memberId: appointment.memberId.toString(),
        userId: appointment.userId.toString(),
        type: InternalNotificationType.textSmsToMember,
        metadata: {
          contentType: ContentKey.appointmentScheduledMember,
          appointmentTime: appointment.start,
        },
      };
      expect(spyOnEventEmitter).toHaveBeenNthCalledWith(
        3,
        EventType.notifyInternal,
        notifyMemberParams,
      );
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
      const eventParams: IEventOnUpdatedAppointment = {
        updatedAppointmentAction: UpdatedAppointmentAction.delete,
        memberId: result.memberId.toString(),
        userId: result.userId.toString(),
        key: result.id,
      };
      expect(spyOnEventEmitter).toBeCalledWith(EventType.onUpdatedAppointment, eventParams);
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

  describe('updateUserInAppointments', () => {
    let spyOnServiceGetFutureAppointments;
    let spyOnScheduleAppointment;
    let spyOnRequestAppointment;

    beforeEach(() => {
      spyOnServiceGetFutureAppointments = jest.spyOn(service, 'getFutureAppointments');
      spyOnScheduleAppointment = jest.spyOn(resolver, 'scheduleAppointment');
      spyOnRequestAppointment = jest.spyOn(resolver, 'requestAppointment');
    });

    afterEach(() => {
      spyOnServiceGetFutureAppointments.mockReset();
      spyOnScheduleAppointment.mockReset();
      spyOnRequestAppointment.mockReset();
      spyOnEventEmitter.mockReset();
    });

    /* eslint-disable-next-line max-len */
    it('should reschedule appointments with the new user (for scheduled appointments)', async () => {
      const oldUserId = generateId();
      const newUserId = generateId();
      const memberId = generateId();

      const mockAppointments = [];
      for (let step = 0; step < 5; step++) {
        const appointment = generateScheduleAppointmentParams({ userId: oldUserId, memberId });
        appointment['status'] = AppointmentStatus.scheduled;
        mockAppointments.push(appointment);
      }
      spyOnServiceGetFutureAppointments.mockImplementationOnce(async () => mockAppointments);

      const params: IEventOnUpdatedUserCommunication = {
        oldUserId,
        newUserId,
        memberId,
      };
      await resolver.updateUserInAppointments(params);

      expect(spyOnScheduleAppointment).toHaveBeenCalledTimes(5);
      mockAppointments.forEach((appointment, index) => {
        appointment.userId = newUserId; // expected user
        delete appointment.status;
        expect(spyOnScheduleAppointment).toHaveBeenNthCalledWith(index + 1, appointment);
      });
      expect(spyOnEventEmitter).toBeCalledWith(EventType.onUpdatedUserAppointments, {
        ...params,
        appointments: mockAppointments,
      });
    });

    /* eslint-disable-next-line max-len */
    it('should re-request appointments with the new user (for requested appointments)', async () => {
      const oldUserId = generateId();
      const newUserId = generateId();
      const memberId = generateId();

      const appointment = generateScheduleAppointmentParams({ userId: oldUserId, memberId });
      appointment['status'] = AppointmentStatus.requested;
      spyOnServiceGetFutureAppointments.mockImplementationOnce(async () => [appointment]);

      const params: IEventOnUpdatedUserCommunication = {
        oldUserId,
        newUserId,
        memberId,
      };
      await resolver.updateUserInAppointments(params);

      const requestAppointmentParams = {
        memberId,
        userId: newUserId,
        id: appointment.id,
      };

      expect(spyOnRequestAppointment).toHaveBeenCalledTimes(1);

      /* eslint-disable-next-line max-len */
      // using objectContaining because it's not possible to test the 'notBefore' field (current time)
      expect(spyOnRequestAppointment).toHaveBeenCalledWith(
        expect.objectContaining(requestAppointmentParams),
      );
      expect(spyOnEventEmitter).toBeCalledWith(EventType.onUpdatedUserAppointments, {
        ...params,
        appointments: [appointment],
      });
    });

    it("shouldn't reschedule appointments if there are no future appointments", async () => {
      spyOnServiceGetFutureAppointments.mockImplementationOnce(async () => []);

      const params: IEventOnUpdatedUserCommunication = {
        oldUserId: generateId(),
        newUserId: generateId(),
        memberId: generateId(),
      };
      await resolver.updateUserInAppointments(params);

      expect(spyOnScheduleAppointment).not.toHaveBeenCalled();
      expect(spyOnEventEmitter).not.toHaveBeenCalled();
    });
  });
});
