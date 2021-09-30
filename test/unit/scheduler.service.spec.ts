import { EventEmitter2 } from '@nestjs/event-emitter';
import { SchedulerRegistry } from '@nestjs/schedule';
import { Test, TestingModule } from '@nestjs/testing';
import * as config from 'config';
import * as faker from 'faker';
import { cloneDeep, difference } from 'lodash';
import { model, Model } from 'mongoose';
import { v4 } from 'uuid';
import {
  Appointment,
  AppointmentDto,
  AppointmentModule,
  AppointmentStatus,
} from '../../src/appointment';
import { EventType, NotificationType, NotifyParams, NotifyParamsDto } from '../../src/common';
import { CommunicationResolver } from '../../src/communication';
import { MemberModule } from '../../src/member';
import { Bitly } from '../../src/providers';
import { SchedulerService } from '../../src/scheduler';
import { dbConnect, dbDisconnect, defaultModules, delay, generateId } from '../index';

describe('SchedulerService', () => {
  let module: TestingModule;
  let schedulerService: SchedulerService;
  let schedulerRegistry: SchedulerRegistry;
  let communicationResolver: CommunicationResolver;
  let eventEmitter: EventEmitter2;
  let appointmentModel: Model<typeof AppointmentDto>;
  let notifyParamsModel: Model<typeof NotifyParamsDto>;
  let bitly: Bitly;

  const days = (config.get('scheduler.maxAlertGapInMin') + 1) * 60 * 1000;
  const whenNotInRange = new Date();
  whenNotInRange.setMilliseconds(whenNotInRange.getMilliseconds() + days);

  const clear = async () => {
    const timeouts = schedulerRegistry.getTimeouts();
    timeouts.map((timeout) => schedulerRegistry.deleteTimeout(timeout));

    //Clearing test inserts
    await notifyParamsModel.deleteMany({});
  };

  const generateCustomFutureNotifyParams = (when: Date = faker.date.soon()): NotifyParams => {
    return {
      memberId: generateId(),
      userId: v4(),
      type: NotificationType.textSms,
      metadata: {
        content: faker.lorem.sentence(),
        when,
      },
    };
  };

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: defaultModules().concat(AppointmentModule, MemberModule),
    }).compile();

    schedulerService = module.get<SchedulerService>(SchedulerService);
    schedulerRegistry = module.get<SchedulerRegistry>(SchedulerRegistry);
    notifyParamsModel = model(NotifyParams.name, NotifyParamsDto);
    appointmentModel = model(Appointment.name, AppointmentDto);
    communicationResolver = module.get<CommunicationResolver>(CommunicationResolver);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
    bitly = module.get<Bitly>(Bitly);

    await dbConnect();
  });

  afterAll(async () => {
    await module.close();
    await dbDisconnect();
  });

  describe('init', () => {
    afterEach(async () => {
      await clear();
    });

    describe('registerCustomFutureNotify', () => {
      it('should register CustomFutureNotification with all scheduled messages', async () => {
        const when1 = new Date();
        when1.setMinutes(when1.getMinutes() + 1);
        const when2 = new Date();
        when2.setMinutes(when2.getMinutes() + 2);
        const when3 = new Date();
        when3.setSeconds(when3.getSeconds() - 1);

        const { _id: id1 } = await notifyParamsModel.create(
          generateCustomFutureNotifyParams(when1),
        );
        const { _id: id2 } = await notifyParamsModel.create(
          generateCustomFutureNotifyParams(when2),
        );
        const { _id: id3 } = await notifyParamsModel.create(
          generateCustomFutureNotifyParams(when3),
        );

        await schedulerService.init();

        const timeouts = schedulerRegistry.getTimeouts();

        expect(timeouts).toContainEqual(id1);
        expect(timeouts).toContainEqual(id2);
        expect(timeouts).not.toContainEqual(id3);
      });

      // eslint-disable-next-line max-len
      it('should not register CustomFutureNotification with future messages more than 1 month', async () => {
        const { _id } = await notifyParamsModel.create(
          generateCustomFutureNotifyParams(whenNotInRange),
        );

        await schedulerService.init();

        const timeouts = schedulerRegistry.getTimeouts();
        expect(timeouts).not.toContainEqual(_id);
      });
    });

    describe('registerAppointmentAlert', () => {
      it('should register AppointmentAlerts for all scheduled appointments', async () => {
        const gapDate = new Date();
        gapDate.setMinutes(gapDate.getMinutes() + config.get('scheduler.alertBeforeInMin'));
        const maxDate = new Date();
        maxDate.setMinutes(maxDate.getMinutes() + config.get('scheduler.maxAlertGapInMin'));

        await schedulerService.init();

        const scheduledAppointments = await appointmentModel
          .find({ status: AppointmentStatus.scheduled, start: { $gte: gapDate, $lte: maxDate } })
          .sort({ start: 1 });

        const timeouts = schedulerRegistry.getTimeouts();
        const timeoutAppointments: any = await appointmentModel.find({ _id: { $in: timeouts } });

        const diff = difference(
          timeoutAppointments.map((item) => item._id.toString()),
          scheduledAppointments.map((item) => item._id.toString()),
        );

        expect(diff).toEqual([]);
      });
    });
  });

  describe('registerCustomFutureNotify', () => {
    afterEach(async () => {
      await clear();
    });

    it('should add a notification params on a new params', async () => {
      const params = [
        generateCustomFutureNotifyParams(),
        generateCustomFutureNotifyParams(),
        generateCustomFutureNotifyParams(),
      ];
      const ids = await Promise.all(
        params.map(async (param) => (await schedulerService.registerCustomFutureNotify(param)).id),
      );

      const timeouts = schedulerRegistry.getTimeouts();
      ids.map((id) => expect(timeouts).toContainEqual(id));
    });

    it('should not add notification params if metadata.when is > 1 month', async () => {
      const param = generateCustomFutureNotifyParams(whenNotInRange);

      const result = await schedulerService.registerCustomFutureNotify(param);
      expect(result).toBeUndefined();
    });

    it('should set timeout and check that it occurs and notifying', async () => {
      await schedulerService.init();

      //Adding 1 second to scheduler.alertBeforeInMin
      const when = new Date();
      when.setSeconds(when.getSeconds() + 1);
      const param = generateCustomFutureNotifyParams(when);

      const { id } = await schedulerService.registerCustomFutureNotify(param);
      let timeouts = schedulerRegistry.getTimeouts();
      expect(timeouts).toContainEqual(id);

      await delay(3000);

      timeouts = schedulerRegistry.getTimeouts();
      expect(timeouts).not.toContainEqual(id);
    });
  });

  describe('registerAppointmentAlert', () => {
    afterEach(async () => {
      await clear();
    });

    const generateAppointmentAlertParam = (start = faker.date.soon(1)) => {
      return {
        id: generateId(),
        memberId: generateId(),
        userId: v4(),
        start,
      };
    };

    it('should update appointment alert with new appointments', async () => {
      const params = [
        generateAppointmentAlertParam(),
        generateAppointmentAlertParam(),
        generateAppointmentAlertParam(),
      ];
      await Promise.all(
        params.map(async (param) => schedulerService.registerAppointmentAlert(param)),
      );

      const timeouts = schedulerRegistry.getTimeouts();

      expect(timeouts.length).toEqual(params.length);
      for (let i = 0; i < params.length; i++) {
        expect(timeouts[i]).toEqual(params[i].id);
      }
    });

    it('should update appointment alert with an existing appointment', async () => {
      const param = generateAppointmentAlertParam();
      await schedulerService.registerAppointmentAlert(param);
      let timeouts = schedulerRegistry.getTimeouts();
      expect(timeouts.length).toEqual(1);
      expect(timeouts[0]).toEqual(param.id);

      const updateParam = cloneDeep(param);
      updateParam.start = faker.date.soon(1);

      await schedulerService.registerAppointmentAlert(updateParam);

      timeouts = schedulerRegistry.getTimeouts();
      expect(timeouts.length).toEqual(1);
      expect(timeouts[0]).toEqual(param.id);
    });

    it('should not add appointment is start > 1 month', async () => {
      const days = (config.get('scheduler.maxAlertGapInMin') + 1) * 60 * 1000;
      const start = new Date();
      start.setMilliseconds(start.getMilliseconds() + days);
      const param = generateAppointmentAlertParam(start);

      await schedulerService.registerAppointmentAlert(param);
      const timeouts = schedulerRegistry.getTimeouts();
      expect(timeouts.length).toEqual(0);
    });

    it('should not add an appointment on start < alertBeforeInMin', async () => {
      const minutes = config.get('scheduler.alertBeforeInMin') - 0.1;
      const start = new Date();
      start.setMinutes(start.getMinutes() + minutes);
      const param = generateAppointmentAlertParam(start);

      await schedulerService.registerAppointmentAlert(param);
      const timeouts = schedulerRegistry.getTimeouts();
      expect(timeouts.length).toEqual(0);
    });

    it('should add appointment is start <= 1 month', async () => {
      const daysInMilliseconds = (config.get('scheduler.maxAlertGapInMin') - 0.1) * 60 * 1000;
      const start = new Date();
      start.setMilliseconds(start.getMilliseconds() + daysInMilliseconds);
      const param = generateAppointmentAlertParam(start);

      await schedulerService.registerAppointmentAlert(param);
      const timeouts = schedulerRegistry.getTimeouts();
      expect(timeouts.length).toEqual(1);
      expect(timeouts[0]).toEqual(param.id);
    });

    it('should add an appointment on start >= alertBeforeInMin', async () => {
      const milliseconds = (config.get('scheduler.alertBeforeInMin') + 0.1) * 60 * 1000;
      const start = new Date();
      start.setMilliseconds(start.getMilliseconds() + milliseconds);
      const param = generateAppointmentAlertParam(start);

      await schedulerService.registerAppointmentAlert(param);
      const timeouts = schedulerRegistry.getTimeouts();
      expect(timeouts.length).toEqual(1);
      expect(timeouts[0]).toEqual(param.id);
    });

    it('should set timeout and check that it occurs and notifying', async () => {
      //Adding 1 second to scheduler.alertBeforeInMin
      const milliseconds = (config.get('scheduler.alertBeforeInMin') + 1 / 60) * 60 * 1000;
      const start = new Date();
      start.setMilliseconds(start.getMilliseconds() + milliseconds);
      const param = generateAppointmentAlertParam(start);
      const { memberId, userId } = param;
      const chat = { memberLink: faker.internet.url(), userLink: faker.internet.url() };

      const spyOnCommunicationResolverGet = jest.spyOn(communicationResolver, 'getCommunication');
      spyOnCommunicationResolverGet.mockResolvedValue({ memberId, userId, chat });
      const spyOnBitlyShortenLink = jest.spyOn(bitly, 'shortenLink');
      const chatLink = 'https://bit.ly/abc';
      spyOnBitlyShortenLink.mockResolvedValue(chatLink);
      const spyOnEventEmitter = jest.spyOn(eventEmitter, 'emit');

      await schedulerService.registerAppointmentAlert(param);
      let timeouts = schedulerRegistry.getTimeouts();
      expect(timeouts.length).toEqual(1);
      expect(timeouts[0]).toEqual(param.id);

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
            .replace('@gapMinutes@', config.get('scheduler.alertBeforeInMin'))
            .replace('@chatLink@', chatLink)}`,
        },
      };
      expect(spyOnEventEmitter).toBeCalledWith(EventType.notify, eventParams);
      expect(spyOnBitlyShortenLink).toBeCalledWith(chat.memberLink);

      spyOnCommunicationResolverGet.mockReset();
      spyOnEventEmitter.mockReset();
      spyOnBitlyShortenLink.mockReset();
    });

    it('should not fail on deleting a non existing appointment', async () => {
      await schedulerService.deleteTimeout({ id: generateId() });
    });

    it('should delete an existing appointment', async () => {
      const id = generateId();
      await schedulerRegistry.addTimeout(id, generateId());
      let timeouts = schedulerRegistry.getTimeouts();
      expect(timeouts[0]).toEqual(id);

      await schedulerService.deleteTimeout({ id });
      timeouts = schedulerRegistry.getTimeouts();
      expect(timeouts.length).toEqual(0);
    });
  });
});
