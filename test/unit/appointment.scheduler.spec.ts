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
import { CommunicationService } from '../../src/communication';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EventType, NotificationType } from '../../src/common';
import { NotifyParams } from '../../src/member';
import { Bitly } from '../../src/providers';

describe('AppointmentScheduler', () => {
  let module: TestingModule;
  let scheduler: AppointmentScheduler;
  let schedulerRegistry: SchedulerRegistry;
  let communicationService: CommunicationService;
  let eventEmitter: EventEmitter2;
  let appointmentModel: Model<typeof AppointmentDto>;
  let bitly: Bitly;

  const clear = async () => {
    const timeouts = schedulerRegistry.getTimeouts();
    timeouts.map((timeout) => schedulerRegistry.deleteTimeout(timeout));
  };

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: defaultModules().concat(AppointmentModule),
    }).compile();

    scheduler = module.get<AppointmentScheduler>(AppointmentScheduler);
    schedulerRegistry = module.get<SchedulerRegistry>(SchedulerRegistry);
    appointmentModel = model(Appointment.name, AppointmentDto);
    communicationService = module.get<CommunicationService>(CommunicationService);
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

    it('should register schedulerRegistry with all scheduled appointments', async () => {
      const gapDate = new Date();
      gapDate.setMinutes(gapDate.getMinutes() + config.get('scheduler.alertBeforeInMin'));
      const maxDate = new Date();
      maxDate.setMinutes(maxDate.getMinutes() + config.get('scheduler.maxAlertGapInMin'));

      await scheduler.init();

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

    it('should update appointment alert with new appointments', async () => {
      const params = [generateParam(), generateParam(), generateParam()];
      await Promise.all(params.map(async (param) => scheduler.registerAppointmentAlert(param)));

      const timeouts = schedulerRegistry.getTimeouts();

      expect(timeouts.length).toEqual(params.length);
      for (let i = 0; i < params.length; i++) {
        expect(timeouts[i]).toEqual(params[i].id);
      }
    });

    it('should update appointment alert with an existing appointment', async () => {
      const param = generateParam();
      await scheduler.registerAppointmentAlert(param);
      let timeouts = schedulerRegistry.getTimeouts();
      expect(timeouts.length).toEqual(1);
      expect(timeouts[0]).toEqual(param.id);

      const updateParam = cloneDeep(param);
      updateParam.start = faker.date.soon(1);

      await scheduler.registerAppointmentAlert(updateParam);

      timeouts = schedulerRegistry.getTimeouts();
      expect(timeouts.length).toEqual(1);
      expect(timeouts[0]).toEqual(param.id);
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
      expect(timeouts.length).toEqual(1);
      expect(timeouts[0]).toEqual(param.id);
    });

    it('should add an appointment on start >= alertBeforeInMin', async () => {
      const milliseconds = (config.get('scheduler.alertBeforeInMin') + 0.1) * 60 * 1000;
      const start = new Date();
      start.setMilliseconds(start.getMilliseconds() + milliseconds);
      const param = generateParam(start);

      await scheduler.registerAppointmentAlert(param);
      const timeouts = schedulerRegistry.getTimeouts();
      expect(timeouts.length).toEqual(1);
      expect(timeouts[0]).toEqual(param.id);
    });

    it('should set timeout and check that it occurs and notifying', async () => {
      //Adding 1 second to scheduler.alertBeforeInMin
      const milliseconds = (config.get('scheduler.alertBeforeInMin') + 1 / 60) * 60 * 1000;
      const start = new Date();
      start.setMilliseconds(start.getMilliseconds() + milliseconds);
      const param = generateParam(start);
      const { memberId, userId } = param;
      const chat = { memberLink: faker.internet.url(), userLink: faker.internet.url() };

      const spyOnCommunicationServiceGet = jest.spyOn(communicationService, 'get');
      spyOnCommunicationServiceGet.mockResolvedValue({ memberId, userId, chat });
      const spyOnBitlyShortenLink = jest.spyOn(bitly, 'shortenLink');
      const chatLink = 'https://bit.ly/abc';
      spyOnBitlyShortenLink.mockResolvedValue(chatLink);
      const spyOnEventEmitter = jest.spyOn(eventEmitter, 'emit');

      await scheduler.registerAppointmentAlert(param);
      let timeouts = schedulerRegistry.getTimeouts();
      expect(timeouts.length).toEqual(1);
      expect(timeouts[0]).toEqual(param.id);

      await delay(3000);

      timeouts = schedulerRegistry.getTimeouts();
      expect(timeouts.length).toEqual(0);

      expect(spyOnCommunicationServiceGet).toBeCalledTimes(1);
      expect(spyOnCommunicationServiceGet).toBeCalledWith({ memberId, userId });

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

      spyOnCommunicationServiceGet.mockReset();
      spyOnEventEmitter.mockReset();
      spyOnBitlyShortenLink.mockReset();
    });
  });

  describe('delete', () => {
    afterEach(async () => {
      await clear();
    });

    it('should not fail on deleting a non existing appointment', async () => {
      await scheduler.deleteTimeout({ id: generateId() });
    });

    it('should delete an existing appointment', async () => {
      const id = generateId();
      await schedulerRegistry.addTimeout(id, generateId());
      let timeouts = schedulerRegistry.getTimeouts();
      expect(timeouts[0]).toEqual(id);

      await scheduler.deleteTimeout({ id });
      timeouts = schedulerRegistry.getTimeouts();
      expect(timeouts.length).toEqual(0);
    });
  });
});
