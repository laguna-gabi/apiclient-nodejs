import { Test, TestingModule } from '@nestjs/testing';
import {
  Appointment,
  AppointmentDto,
  AppointmentModule,
  AppointmentScheduler,
  AppointmentStatus,
} from '../../src/appointment';
import { dbConnect, dbDisconnect, defaultModules, delay, generateId } from '../index';
import { SchedulerRegistry } from '@nestjs/schedule';
import { model, Model } from 'mongoose';
import * as config from 'config';
import { cloneDeep, difference } from 'lodash';
import { v4 } from 'uuid';
import * as faker from 'faker';
import { CommunicationResolver } from '../../src/communication';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ReminderType, EventType, NotificationType } from '../../src/common';
import { NotifyParams } from '../../src/member';
import { Bitly } from '../../src/providers';
import { add } from 'date-fns';
import { InternalSchedulerService, LeaderType } from '../../src/scheduler';

describe('AppointmentScheduler', () => {
  let module: TestingModule;
  let scheduler: AppointmentScheduler;
  let schedulerRegistry: SchedulerRegistry;
  let communicationResolver: CommunicationResolver;
  let eventEmitter: EventEmitter2;
  let appointmentModel: Model<typeof AppointmentDto>;
  let bitly: Bitly;
  let internalSchedulerService: InternalSchedulerService;

  const clear = async () => {
    const timeouts = schedulerRegistry.getTimeouts();
    timeouts.map((timeout) => schedulerRegistry.deleteTimeout(timeout));
    await internalSchedulerService.resetLeader(LeaderType.appointment);
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    scheduler.amITheLeader = false;
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
  };

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: defaultModules().concat(AppointmentModule),
    }).compile();

    scheduler = module.get<AppointmentScheduler>(AppointmentScheduler);
    schedulerRegistry = module.get<SchedulerRegistry>(SchedulerRegistry);
    appointmentModel = model(Appointment.name, AppointmentDto);
    communicationResolver = module.get<CommunicationResolver>(CommunicationResolver);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
    bitly = module.get<Bitly>(Bitly);
    internalSchedulerService = module.get<InternalSchedulerService>(InternalSchedulerService);

    await dbConnect();
    await internalSchedulerService.resetLeader(LeaderType.appointment);
  });

  afterAll(async () => {
    await module.close();
    await dbDisconnect();
  });

  describe('init', () => {
    /* eslint-disable max-len */
    /**
     * In this test we compare the appointments from the database to the ones that should ne scheduled
     * some times there are appointments that are ended in the middle of this test (status done),
     * so we test the difference between the compares and check if its status is not scheduled.
     */
    /* eslint-enable max-len */
    describe('registerAppointmentAlert', () => {
      afterEach(async () => {
        await clear();
      });

      it('should register schedulerRegistry with all scheduled appointments', async () => {
        const gapDate = new Date();
        gapDate.setMinutes(gapDate.getMinutes() + config.get('scheduler.alertBeforeInMin'));
        const maxDate = new Date();
        maxDate.setMinutes(maxDate.getMinutes() + config.get('scheduler.maxAlertGapInMin'));

        await scheduler.init();

        const scheduledAppointments = await appointmentModel
          .find({ status: AppointmentStatus.scheduled, start: { $gte: gapDate, $lte: maxDate } })
          .sort({ start: 1 });

        const filterTimeouts = schedulerRegistry
          .getTimeouts()
          .filter((timeout) => timeout.includes(ReminderType.appointmentReminder));

        const diff = difference(
          filterTimeouts,
          scheduledAppointments.map((item) => item._id + ReminderType.appointmentReminder),
        );

        expect(diff).toEqual([]);
      }, 10000);
    });

    describe('scheduleAppointmentLongAlert', () => {
      afterEach(async () => {
        await clear();
      });

      // eslint-disable-next-line max-len
      it('should register scheduleAppointmentLongAlert with all scheduled appointments', async () => {
        const maxDate = new Date();
        maxDate.setMinutes(maxDate.getMinutes() + config.get('scheduler.maxAlertGapInMin'));
        const scheduledAppointments = await appointmentModel
          .find({
            status: AppointmentStatus.scheduled,
            start: { $gte: add(new Date(), { days: 1 }), $lte: maxDate },
          })
          .sort({ start: 1 });

        await scheduler.init();

        const filterTimeouts = schedulerRegistry
          .getTimeouts()
          .filter((timeout) => timeout.includes(ReminderType.appointmentLongReminder));

        const diff = difference(
          filterTimeouts,
          scheduledAppointments.map((item) => item._id + ReminderType.appointmentLongReminder),
        );

        expect(diff).toEqual([]);
      }, 10000);
    });
  });

  describe('registerAppointmentAlert', () => {
    afterEach(async () => {
      await clear();
    });

    const generateParam = (start = faker.date.soon(1)) => {
      return {
        id: generateId(),
        memberId: generateId(),
        userId: v4(),
        start,
      };
    };

    it('should schedule appointment alert with new appointments', async () => {
      const params = [generateParam(), generateParam(), generateParam()];
      await Promise.all(params.map(async (param) => scheduler.registerAppointmentAlert(param)));

      const timeouts = schedulerRegistry.getTimeouts();

      expect(timeouts.length).toEqual(params.length);
      for (let i = 0; i < params.length; i++) {
        expect(timeouts[i]).toEqual(params[i].id + ReminderType.appointmentReminder);
      }
    });

    it('should update appointment alert with an existing appointment', async () => {
      const param = generateParam();
      await scheduler.registerAppointmentAlert(param);
      let timeouts = schedulerRegistry.getTimeouts();
      expect(timeouts.length).toEqual(1);
      expect(timeouts[0]).toEqual(param.id + ReminderType.appointmentReminder);

      const updateParam = cloneDeep(param);
      updateParam.start = faker.date.soon(1);

      await scheduler.registerAppointmentAlert(updateParam);

      timeouts = schedulerRegistry.getTimeouts();
      expect(timeouts.length).toEqual(1);
      expect(timeouts[0]).toEqual(param.id + ReminderType.appointmentReminder);
    });

    it('should not add appointment is start > 1 month', async () => {
      const days = (config.get('scheduler.maxAlertGapInMin') + 1) * 60 * 1000;
      const start = new Date();
      start.setMilliseconds(start.getMilliseconds() + days);
      const param = generateParam(start);

      await scheduler.registerAppointmentAlert(param);
      const timeouts = schedulerRegistry.getTimeouts();
      expect(timeouts.length).toEqual(0);
    });

    it('should not add an appointment on start < alertBeforeInMin', async () => {
      const minutes = config.get('scheduler.alertBeforeInMin') - 0.1;
      const start = new Date();
      start.setMinutes(start.getMinutes() + minutes);
      const param = generateParam(start);

      await scheduler.registerAppointmentAlert(param);
      const timeouts = schedulerRegistry.getTimeouts();
      expect(timeouts.length).toEqual(0);
    });

    it('should add appointment is start <= 1 month', async () => {
      const daysInMilliseconds = (config.get('scheduler.maxAlertGapInMin') - 0.1) * 60 * 1000;
      const start = new Date();
      start.setMilliseconds(start.getMilliseconds() + daysInMilliseconds);
      const param = generateParam(start);

      await scheduler.registerAppointmentAlert(param);
      const timeouts = schedulerRegistry.getTimeouts();
      expect(timeouts.length).toEqual(2);
      expect(timeouts[0]).toEqual(param.id + ReminderType.appointmentReminder);
    });

    it('should add an appointment on start >= alertBeforeInMin', async () => {
      const milliseconds = (config.get('scheduler.alertBeforeInMin') + 0.1) * 60 * 1000;
      const start = new Date();
      start.setMilliseconds(start.getMilliseconds() + milliseconds);
      const param = generateParam(start);

      await scheduler.registerAppointmentAlert(param);
      const timeouts = schedulerRegistry.getTimeouts();
      expect(timeouts.length).toEqual(1);
      expect(timeouts[0]).toEqual(param.id + ReminderType.appointmentReminder);
    });

    it('should set timeout and check that it occurs and notifying', async () => {
      //Adding 1 second to scheduler.alertBeforeInMin
      const milliseconds = (config.get('scheduler.alertBeforeInMin') + 1 / 60) * 60 * 1000;
      const start = new Date();
      start.setMilliseconds(start.getMilliseconds() + milliseconds);
      const param = generateParam(start);
      const { memberId, userId } = param;
      const chat = { memberLink: faker.internet.url(), userLink: faker.internet.url() };

      const spyOnCommunicationResolverGet = jest.spyOn(communicationResolver, 'getCommunication');
      spyOnCommunicationResolverGet.mockResolvedValue({ memberId, userId, chat });
      const spyOnBitlyShortenLink = jest.spyOn(bitly, 'shortenLink');
      const chatLink = 'https://bit.ly/abc';
      spyOnBitlyShortenLink.mockResolvedValue(chatLink);
      const spyOnEventEmitter = jest.spyOn(eventEmitter, 'emit');

      await scheduler.registerAppointmentAlert(param);
      let timeouts = schedulerRegistry.getTimeouts();
      expect(timeouts.length).toEqual(1);
      expect(timeouts[0]).toEqual(param.id + ReminderType.appointmentReminder);

      await delay(3000);

      timeouts = schedulerRegistry.getTimeouts();
      expect(timeouts.length).toEqual(0);

      expect(spyOnCommunicationResolverGet).toBeCalledTimes(1);
      expect(spyOnCommunicationResolverGet).toBeCalledWith({ memberId, userId });

      expect(spyOnEventEmitter).toBeCalledTimes(1);
      const eventParams: NotifyParams = {
        memberId,
        userId,
        type: NotificationType.text,
        metadata: {
          content: `${config
            .get('contents.appointmentReminder')
            .replace('@gapMinutes@', config.get('scheduler.alertBeforeInMin'))}`,
          chatLink,
        },
      };
      expect(spyOnEventEmitter).toBeCalledWith(EventType.notify, eventParams);
      expect(spyOnBitlyShortenLink).toBeCalledWith(chat.memberLink);

      spyOnCommunicationResolverGet.mockReset();
      spyOnEventEmitter.mockReset();
      spyOnBitlyShortenLink.mockReset();
    }, 12000);
  });

  describe('scheduleAppointmentLongAlert', () => {
    afterEach(async () => {
      await clear();
    });

    const generateParam = (start = add(faker.date.soon(1), { days: 1 })) => {
      return {
        id: generateId(),
        memberId: generateId(),
        userId: v4(),
        start,
      };
    };

    it('should schedule appointment long alert with new appointments', async () => {
      const params = [generateParam(), generateParam(), generateParam()];
      await Promise.all(params.map(async (param) => scheduler.registerAppointmentAlert(param)));

      const timeouts = schedulerRegistry.getTimeouts();

      const longTimeouts = params.map(
        (appointment) => appointment.id + ReminderType.appointmentLongReminder,
      );

      expect(timeouts.length).toEqual(params.length * 2);
      expect(timeouts).toEqual(expect.arrayContaining(longTimeouts));
    });

    it('should update appointment long alert with an existing appointment', async () => {
      const param = generateParam();
      await scheduler.registerAppointmentAlert(param);
      const timeouts = schedulerRegistry.getTimeouts();
      expect(timeouts.length).toEqual(2);
      expect(timeouts[0]).toEqual(param.id + ReminderType.appointmentReminder);

      await updateAppointmentWithParams(param);
    });

    // eslint-disable-next-line max-len
    it('should add appointment long alert for an existing appointment if starts in more than 1 day', async () => {
      const param = generateParam(faker.date.soon(1));
      await scheduler.registerAppointmentAlert(param);
      const timeouts = schedulerRegistry.getTimeouts();
      expect(timeouts.length).toEqual(1);
      expect(timeouts[0]).toEqual(param.id + ReminderType.appointmentReminder);

      await updateAppointmentWithParams(param);
    });

    const updateAppointmentWithParams = async (param) => {
      const updateParam = cloneDeep(param);
      updateParam.start = add(faker.date.soon(1), { days: 2 });

      await scheduler.registerAppointmentAlert(updateParam);

      const timeouts = schedulerRegistry.getTimeouts();

      expect(timeouts.length).toEqual(2);
      expect(timeouts[1]).toEqual(param.id + ReminderType.appointmentLongReminder);
    };
  });

  describe('delete', () => {
    afterEach(async () => {
      await clear();
    });

    it('should not fail on deleting a non existing appointment', async () => {
      await scheduler.deleteTimeout({ id: generateId() });
    });
  });
});
