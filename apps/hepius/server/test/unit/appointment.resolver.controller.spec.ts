import { AppointmentInternalKey, RegisterInternalKey, generateDispatchId } from '@argus/irisClient';
import {
  Platform,
  generateId,
  generateObjectId,
  mockLogger,
  mockProcessWarnings,
} from '@argus/pandora';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { addMinutes } from 'date-fns';
import { datatype } from 'faker';
import { v4 } from 'uuid';
import {
  dbDisconnect,
  defaultModules,
  generateAppointmentLink,
  generateNotesParams,
  generateRequestAppointmentParams,
  generateScheduleAppointmentParams,
  generateUpdateNotesParams,
  mockGenerateMember,
  mockGenerateUser,
} from '..';
import {
  AppointmentController,
  AppointmentModule,
  AppointmentResolver,
  AppointmentService,
  ScheduleAppointmentParams,
} from '../../src/appointment';
import {
  ErrorType,
  Errors,
  EventType,
  IEventOnNewMember,
  IEventOnUpdatedAppointment,
  IEventOnUpdatedUserCommunication,
  LoggerService,
  UpdatedAppointmentAction,
} from '../../src/common';
import { Appointment, AppointmentMethod, AppointmentStatus } from '@argus/hepiusClient';
import { JourneyModule, JourneyService } from '../../src/journey';

// mock uuid.v4
jest.mock('uuid', () => {
  const actualUUID = jest.requireActual('uuid');
  const mockV4 = jest.fn(actualUUID.v4);
  return { v4: mockV4 };
});

describe('AppointmentResolver', () => {
  let module: TestingModule;
  let resolver: AppointmentResolver;
  let controller: AppointmentController;
  let service: AppointmentService;
  let journeyService: JourneyService;
  let eventEmitter: EventEmitter2;
  let spyOnEventEmitter;
  const fakeUUID = datatype.uuid();

  beforeAll(async () => {
    mockProcessWarnings(); // to hide pino prettyPrint warning
    module = await Test.createTestingModule({
      imports: defaultModules().concat(AppointmentModule, JourneyModule),
    }).compile();

    resolver = module.get<AppointmentResolver>(AppointmentResolver);
    controller = module.get<AppointmentController>(AppointmentController);
    service = module.get<AppointmentService>(AppointmentService);
    journeyService = module.get<JourneyService>(JourneyService);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
    spyOnEventEmitter = jest.spyOn(eventEmitter, 'emit');
    mockLogger(module.get<LoggerService>(LoggerService));
    (v4 as jest.Mock).mockImplementation(() => fakeUUID);
  });

  afterAll(async () => {
    await module.close();
    await dbDisconnect();
    (v4 as jest.Mock).mockRestore();
  });

  describe('requestAppointment', () => {
    let spyOnServiceInsert;
    let spyOnServiceGet;
    let spyOnJourneyServiceGetRecent;

    beforeEach(() => {
      spyOnServiceInsert = jest.spyOn(service, 'request');
      spyOnServiceGet = jest.spyOn(service, 'get');
      spyOnJourneyServiceGetRecent = jest.spyOn(journeyService, 'getRecent');
    });

    afterEach(() => {
      spyOnServiceInsert.mockReset();
      spyOnServiceGet.mockReset();
      spyOnJourneyServiceGetRecent.mockReset();
      spyOnEventEmitter.mockReset();
    });

    it('should create an appointment', async () => {
      const params = generateRequestAppointmentParams();
      const journeyId = generateId();
      const id = generateId();
      const appointment = {
        ...params,
        id,
        status: AppointmentStatus.requested,
        method: AppointmentMethod.videoCall,
        link: generateAppointmentLink(id),
      };
      spyOnServiceInsert.mockImplementationOnce(async () => appointment);
      spyOnJourneyServiceGetRecent.mockResolvedValue({ id: journeyId });

      await resolver.requestAppointment(appointment);

      expect(spyOnJourneyServiceGetRecent).toHaveBeenCalledWith(params.memberId);
      expect(spyOnServiceInsert).toBeCalledTimes(1);
      expect(spyOnServiceInsert).toHaveBeenCalledWith({
        ...appointment,
        journeyId,
      });
      expect(spyOnEventEmitter).toBeCalled();
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
    let spyOnJourneyServiceGetRecent;

    beforeEach(() => {
      spyOnServiceSchedule = jest.spyOn(service, 'schedule');
      spyOnServiceGet = jest.spyOn(service, 'get');
      spyOnJourneyServiceGetRecent = jest.spyOn(journeyService, 'getRecent');
    });

    afterEach(() => {
      spyOnServiceSchedule.mockReset();
      spyOnServiceGet.mockReset();
      spyOnJourneyServiceGetRecent.mockReset();
      spyOnEventEmitter.mockReset();
    });

    it('should not notify user & member for past appointments', async () => {
      const journeyId = generateId();
      const appointment = generateScheduleAppointmentParams({
        start: addMinutes(new Date(), -10),
        end: addMinutes(new Date(), 20),
      });
      spyOnJourneyServiceGetRecent.mockResolvedValue({ id: journeyId });

      await resolver.scheduleAppointment(appointment);

      expect(spyOnEventEmitter).toBeCalledTimes(5);
      expect(spyOnEventEmitter).toHaveBeenNthCalledWith(
        1,
        EventType.onNewAppointment,
        expect.anything(),
      );
      expect(spyOnEventEmitter).toHaveBeenNthCalledWith(
        2,
        EventType.onUpdatedAppointment,
        expect.anything(),
      );
      expect(spyOnEventEmitter).toHaveBeenNthCalledWith(3, EventType.notifyDeleteDispatch, {
        dispatchId: generateDispatchId(RegisterInternalKey.newMemberNudge, appointment.memberId),
      });
      expect(spyOnEventEmitter).toHaveBeenNthCalledWith(4, EventType.notifyDeleteDispatch, {
        dispatchId: generateDispatchId(
          RegisterInternalKey.newRegisteredMember,
          appointment.memberId,
        ),
      });
      expect(spyOnEventEmitter).toHaveBeenNthCalledWith(5, EventType.notifyDeleteDispatch, {
        dispatchId: generateDispatchId(
          RegisterInternalKey.newRegisteredMemberNudge,
          appointment.memberId,
        ),
      });
    });

    test.each`
      type            | method
      ${'resolver'}   | ${async (appointment) => await resolver.scheduleAppointment(appointment)}
      ${'controller'} | ${async (appointment) => await controller.scheduleAppointment(appointment)}
    `(`should get an appointment via $type for a given id`, async (params) => {
      const journeyId = generateId();
      const appointment = generateScheduleAppointmentParams();
      const mockResult = { ...appointment, status: AppointmentStatus.scheduled, id: generateId() };
      spyOnJourneyServiceGetRecent.mockResolvedValue({ id: journeyId });
      spyOnServiceSchedule.mockImplementationOnce(async () => mockResult);
      spyOnServiceGet.mockImplementationOnce(async () => undefined);

      const result = await params.method(appointment);

      expect(result).toEqual(mockResult);
      expect(spyOnServiceSchedule).toBeCalledWith({
        ...appointment,
        journeyId,
      });
    });

    it(`should not allow editing appointment on status=${AppointmentStatus.done}`, async () => {
      const journeyId = generateId();
      const appointment = generateScheduleAppointmentParams();
      const mockResult = { ...appointment, status: AppointmentStatus.scheduled, id: generateId() };
      spyOnJourneyServiceGetRecent.mockResolvedValue({ id: journeyId });
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
      const journeyId = generateId();
      const appointment = generateScheduleAppointmentParams();
      const mockResult = { ...appointment, status: AppointmentStatus.scheduled, id: generateId() };
      spyOnJourneyServiceGetRecent.mockResolvedValue({ id: journeyId });
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
      const journeyId = generateId();
      const status = AppointmentStatus.scheduled;
      const appointment = generateScheduleAppointmentParams();
      spyOnJourneyServiceGetRecent.mockResolvedValue({ id: journeyId });
      spyOnServiceSchedule.mockImplementationOnce(async () => ({ ...appointment, status }));
      spyOnServiceGet.mockImplementationOnce(async () => undefined);

      const result = await resolver.scheduleAppointment(appointment);

      const eventParams: IEventOnUpdatedAppointment = {
        updatedAppointmentAction: UpdatedAppointmentAction.edit,
        memberId: result.memberId.toString(),
        userId: result.userId.toString(),
        key: result.id,
        value: { status: result.status, start: result.start },
      };
      expect(spyOnEventEmitter).toBeCalledWith(EventType.onUpdatedAppointment, eventParams);
    });
  });

  describe('deleteAppointment', () => {
    let spyOnServiceValidatedUpdateAppointment: jest.SpyInstance;
    let spyOnServiceDeleteAppointment: jest.SpyInstance;
    let spyOnGet: jest.SpyInstance;

    beforeEach(() => {
      spyOnServiceValidatedUpdateAppointment = jest.spyOn(service, 'validateUpdateAppointment');
      spyOnServiceDeleteAppointment = jest.spyOn(service, 'delete');
      spyOnGet = jest.spyOn(service, 'get');
    });

    afterEach(() => {
      spyOnServiceValidatedUpdateAppointment.mockReset();
      spyOnServiceDeleteAppointment.mockReset();
      spyOnEventEmitter.mockReset();
      spyOnGet.mockReset();
    });

    // eslint-disable-next-line max-len
    it(`should fail to delete an existing appointment with status ${AppointmentStatus.done}`, async () => {
      spyOnGet.mockResolvedValue({ status: AppointmentStatus.done } as Appointment);

      await expect(resolver.deleteAppointment(generateId(), generateId())).rejects.toThrow(
        Errors.get(ErrorType.appointmentCanNotBeUpdated),
      );

      expect(spyOnServiceDeleteAppointment).not.toHaveBeenCalled();
      expect(spyOnEventEmitter).not.toHaveBeenCalled();
    });

    // eslint-disable-next-line max-len
    it(`should delete an existing appointment with status ${AppointmentStatus.scheduled}`, async () => {
      const appointment = {
        id: generateId(),
        memberId: generateObjectId(),
        status: AppointmentStatus.scheduled,
      };
      const userId = generateId();

      spyOnGet.mockResolvedValue(appointment as Appointment);
      spyOnServiceDeleteAppointment.mockResolvedValue(true);

      await resolver.deleteAppointment(userId, appointment.id);

      expect(spyOnServiceDeleteAppointment).toBeCalledWith({
        id: appointment.id,
        deletedBy: userId,
      });
      expect(spyOnEventEmitter).toBeCalled();
    });
  });

  describe('endAppointment', () => {
    let spyOnServiceEnd;
    let spyOneGetMemberScheduledAppointments;

    beforeEach(() => {
      spyOnServiceEnd = jest.spyOn(service, 'end');
      spyOneGetMemberScheduledAppointments = jest.spyOn(service, 'getMemberScheduledAppointments');
    });

    afterEach(() => {
      spyOnServiceEnd.mockReset();
      spyOnEventEmitter.mockReset();
      spyOneGetMemberScheduledAppointments.mockReset();
    });

    it('should end an existing appointment for a given id', async () => {
      const appointment = {
        id: generateId(),
        ...generateRequestAppointmentParams(),
        status: AppointmentStatus.done,
        method: AppointmentMethod.phoneCall,
      };
      spyOnServiceEnd.mockImplementationOnce(async () => appointment);
      spyOneGetMemberScheduledAppointments.mockImplementationOnce(async () => [appointment]);

      const result = await resolver.endAppointment({ id: appointment.id });
      expect(spyOnServiceEnd).toBeCalledWith({ id: appointment.id });
      expect(result).toEqual(appointment);

      expect(spyOnEventEmitter).toBeCalledTimes(3);
      expect(spyOnEventEmitter).toBeCalledWith(EventType.onUpdatedAppointment, expect.anything());
      expect(spyOnEventEmitter).toBeCalledWith(EventType.notifyDeleteDispatch, {
        dispatchId: generateDispatchId(
          AppointmentInternalKey.appointmentReminder,
          appointment.id,
          appointment.memberId,
        ),
      });
      expect(spyOnEventEmitter).toBeCalledWith(EventType.notifyDeleteDispatch, {
        dispatchId: generateDispatchId(
          AppointmentInternalKey.appointmentLongReminder,
          appointment.id,
          appointment.memberId,
        ),
      });
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

  describe('onNewMember', () => {
    let spyOnRequestAppointment;
    let spyOnJourneyServiceGetRecent;

    beforeEach(() => {
      spyOnRequestAppointment = jest.spyOn(service, 'request');
      spyOnJourneyServiceGetRecent = jest.spyOn(journeyService, 'getRecent');
    });

    afterEach(() => {
      spyOnRequestAppointment.mockReset();
      spyOnJourneyServiceGetRecent.mockReset();
      spyOnEventEmitter.mockReset();
    });

    it(`should emit ${EventType.onFirstAppointment}`, async () => {
      const journeyId = generateId();
      const appointmentId = generateId();
      const params: IEventOnNewMember = {
        member: mockGenerateMember(),
        user: mockGenerateUser(),
        platform: Platform.android,
      };
      spyOnRequestAppointment.mockResolvedValue({ id: appointmentId });
      spyOnJourneyServiceGetRecent.mockResolvedValue({ id: journeyId });

      await resolver.onNewMember(params);

      expect(spyOnEventEmitter).toBeCalledWith(EventType.onFirstAppointment, {
        memberId: params.member.id.toString(),
        appointmentId,
      });
    });
  });

  describe('updateUserInAppointments', () => {
    let spyOnServiceGetFutureAppointments;
    let spyOnScheduleAppointment;
    let spyOnRequestAppointment;
    let spyOnJourneyServiceGetRecent;

    beforeEach(() => {
      spyOnServiceGetFutureAppointments = jest.spyOn(service, 'getFutureAppointments');
      spyOnScheduleAppointment = jest.spyOn(resolver, 'scheduleAppointment');
      spyOnRequestAppointment = jest.spyOn(resolver, 'requestAppointment');
      spyOnJourneyServiceGetRecent = jest.spyOn(journeyService, 'getRecent');
    });

    afterEach(() => {
      spyOnServiceGetFutureAppointments.mockReset();
      spyOnScheduleAppointment.mockReset();
      spyOnRequestAppointment.mockReset();
      spyOnJourneyServiceGetRecent.mockReset();
      spyOnEventEmitter.mockReset();
    });

    /* eslint-disable-next-line max-len */
    it('should reschedule appointments with the new user (for scheduled appointments)', async () => {
      const oldUserId = generateId();
      const newUserId = generateId();
      const memberId = generateId();
      const journeyId = generateId();

      const mockAppointments = [];
      for (let step = 0; step < 5; step++) {
        const appointment = generateScheduleAppointmentParams({ userId: oldUserId, memberId });
        appointment['status'] = AppointmentStatus.scheduled;
        mockAppointments.push(appointment);
      }
      spyOnServiceGetFutureAppointments.mockImplementationOnce(async () => mockAppointments);
      spyOnJourneyServiceGetRecent.mockResolvedValue({ id: journeyId });

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
      const journeyId = generateId();

      const appointment = generateScheduleAppointmentParams({ userId: oldUserId, memberId });
      appointment['status'] = AppointmentStatus.requested;
      spyOnServiceGetFutureAppointments.mockImplementationOnce(async () => [appointment]);
      spyOnJourneyServiceGetRecent.mockResolvedValue({ id: journeyId });

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
      const journeyId = generateId();
      spyOnServiceGetFutureAppointments.mockImplementationOnce(async () => []);
      spyOnJourneyServiceGetRecent.mockResolvedValue({ id: journeyId });

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
