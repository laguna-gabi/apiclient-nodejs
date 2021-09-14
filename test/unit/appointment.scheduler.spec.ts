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
import { EventType, NotificationType } from '../../src/common';
import { NotifyParams } from '../../src/member';

describe('AppointmentScheduler', () => {
  let module: TestingModule;
  let scheduler: AppointmentScheduler;
  let schedulerRegistry: SchedulerRegistry;
  let communicationResolver: CommunicationResolver;
  let eventEmitter: EventEmitter2;
  let appointmentModel: Model<typeof AppointmentDto>;

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
    communicationResolver = module.get<CommunicationResolver>(CommunicationResolver);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);

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
      gapDate.setMinutes(gapDate.getMinutes() + config.get('appointments.alertBeforeInMin'));
      const maxDate = new Date();
      maxDate.setMinutes(maxDate.getMinutes() + config.get('appointments.maxAlertGapInMin'));

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

  describe('updateAppointmentAlert', () => {
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
      await Promise.all(params.map(async (param) => scheduler.updateAppointmentAlert(param)));

      const timeouts = schedulerRegistry.getTimeouts();

      expect(timeouts.length).toEqual(params.length);
      for (let i = 0; i < params.length; i++) {
        expect(timeouts[i]).toEqual(params[i].id);
      }
    });

    it('should update appointment alert with an existing appointment', async () => {
      const param = generateParam();
      await scheduler.updateAppointmentAlert(param);
      let timeouts = schedulerRegistry.getTimeouts();
      expect(timeouts.length).toEqual(1);
      expect(timeouts[0]).toEqual(param.id);

      const updateParam = cloneDeep(param);
      updateParam.start = faker.date.soon(1);

      await scheduler.updateAppointmentAlert(updateParam);

      timeouts = schedulerRegistry.getTimeouts();
      expect(timeouts.length).toEqual(1);
      expect(timeouts[0]).toEqual(param.id);
    });

    it('should not add appointment is start > 1 month', async () => {
      const days = (config.get('appointments.maxAlertGapInMin') + 1) * 60 * 1000;
      const start = new Date();
      start.setMilliseconds(start.getMilliseconds() + days);
      const param = generateParam(start);

      await scheduler.updateAppointmentAlert(param);
      const timeouts = schedulerRegistry.getTimeouts();
      expect(timeouts.length).toEqual(0);
    });

    it('should not add an appointment on start < alertBeforeInMin', async () => {
      const minutes = config.get('appointments.alertBeforeInMin') - 0.1;
      const start = new Date();
      start.setMinutes(start.getMinutes() + minutes);
      const param = generateParam(start);

      await scheduler.updateAppointmentAlert(param);
      const timeouts = schedulerRegistry.getTimeouts();
      expect(timeouts.length).toEqual(0);
    });

    it('should add appointment is start <= 1 month', async () => {
      const daysInMilliseconds = (config.get('appointments.maxAlertGapInMin') - 0.1) * 60 * 1000;
      const start = new Date();
      start.setMilliseconds(start.getMilliseconds() + daysInMilliseconds);
      const param = generateParam(start);

      await scheduler.updateAppointmentAlert(param);
      const timeouts = schedulerRegistry.getTimeouts();
      expect(timeouts.length).toEqual(1);
      expect(timeouts[0]).toEqual(param.id);
    });

    it('should add an appointment on start >= alertBeforeInMin', async () => {
      const milliseconds = (config.get('appointments.alertBeforeInMin') + 0.1) * 60 * 1000;
      const start = new Date();
      start.setMilliseconds(start.getMilliseconds() + milliseconds);
      const param = generateParam(start);

      await scheduler.updateAppointmentAlert(param);
      const timeouts = schedulerRegistry.getTimeouts();
      expect(timeouts.length).toEqual(1);
      expect(timeouts[0]).toEqual(param.id);
    });

    it('should set timeout and check that it occurs and notifying', async () => {
      //Adding 1 second to appointments.alertBeforeInMin
      const milliseconds = (config.get('appointments.alertBeforeInMin') + 1 / 60) * 60 * 1000;
      const start = new Date();
      start.setMilliseconds(start.getMilliseconds() + milliseconds);
      const param = generateParam(start);
      const { memberId, userId } = param;
      const chat = { memberLink: faker.internet.url(), userLink: faker.internet.url() };

      const spyOnCommunicationResolverGet = jest.spyOn(communicationResolver, 'getCommunication');
      spyOnCommunicationResolverGet.mockResolvedValue({ memberId, userId, chat });
      const spyOnEventEmitter = jest.spyOn(eventEmitter, 'emit');

      await scheduler.updateAppointmentAlert(param);
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
          text: {
            content: `${config
              .get('contents.appointmentReminder')
              .replace('@gapMinutes@', config.get('appointments.alertBeforeInMin'))
              .replace('@chatLink@', chat.memberLink)}`,
          },
        },
      };
      expect(spyOnEventEmitter).toBeCalledWith(EventType.notify, eventParams);

      spyOnCommunicationResolverGet.mockReset();
      spyOnEventEmitter.mockReset();
    });
  });

  describe('delete', () => {
    afterEach(async () => {
      await clear();
    });

    it('should not fail on deleting a non existing appointment', async () => {
      await scheduler.deleteAppointmentAlert({ id: generateId() });
    });

    it('should delete an existing appointment', async () => {
      const id = generateId();
      await schedulerRegistry.addTimeout(id, generateId());
      let timeouts = schedulerRegistry.getTimeouts();
      expect(timeouts[0]).toEqual(id);

      await scheduler.deleteAppointmentAlert({ id });
      timeouts = schedulerRegistry.getTimeouts();
      expect(timeouts.length).toEqual(0);
    });
  });
});
