import { Test, TestingModule } from '@nestjs/testing';
import {
  dbConnect,
  dbDisconnect,
  defaultModules,
  delay,
  generateCreateMemberParams,
  generateCreateRawUserParams,
  generateId,
  generateOrgParams,
} from '../index';
import { SchedulerRegistry } from '@nestjs/schedule';
import {
  MemberModule,
  MemberScheduler,
  MemberService,
  NotifyParams,
  NotifyParamsDto,
} from '../../src/member';
import { model, Model } from 'mongoose';
import { NotificationType } from '../../src/common';
import * as faker from 'faker';
import { v4 } from 'uuid';
import * as config from 'config';
import { Org, OrgDto } from '../../src/org';
import { User, UserDto } from '../../src/user';

describe('MemberScheduler', () => {
  let module: TestingModule;
  let service: MemberService;
  let scheduler: MemberScheduler;
  let notifyParamsModel: Model<typeof NotifyParamsDto>;
  let schedulerRegistry: SchedulerRegistry;
  let modelUser: Model<typeof UserDto>;
  let modelOrg: Model<typeof OrgDto>;
  // eslint-disable-next-line @typescript-eslint/no-empty-function

  const days = (config.get('scheduler.maxAlertGapInMin') + 1) * 60 * 1000;
  const whenNotInRange = new Date();
  whenNotInRange.setMilliseconds(whenNotInRange.getMilliseconds() + days);

  const clear = async () => {
    const timeouts = schedulerRegistry.getTimeouts();
    timeouts.map((timeout) => schedulerRegistry.deleteTimeout(timeout));

    //Clearing test inserts
    await notifyParamsModel.deleteMany({});
  };

  const generateParams = (when: Date = faker.date.soon()): NotifyParams => {
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
      imports: defaultModules().concat(MemberModule),
    }).compile();

    service = module.get<MemberService>(MemberService);
    modelUser = model(User.name, UserDto);
    modelOrg = model(Org.name, OrgDto);

    scheduler = module.get<MemberScheduler>(MemberScheduler);
    notifyParamsModel = model(NotifyParams.name, NotifyParamsDto);
    schedulerRegistry = module.get<SchedulerRegistry>(SchedulerRegistry);

    await dbConnect();
  });

  afterAll(async () => {
    await module.close();
    await dbDisconnect();
  });

  describe('init', () => {
    describe('registerCustomFutureNotify', () => {
      afterEach(async () => {
        await clear();
      });

      it('should register schedulerRegistry with all scheduled messages', async () => {
        const when1 = new Date();
        when1.setMinutes(when1.getMinutes() + 1);
        const when2 = new Date();
        when2.setMinutes(when2.getMinutes() + 2);
        const when3 = new Date();
        when3.setSeconds(when3.getSeconds() - 1);

        const { _id: id1 } = await notifyParamsModel.create(generateParams(when1));
        const { _id: id2 } = await notifyParamsModel.create(generateParams(when2));
        const { _id: id3 } = await notifyParamsModel.create(generateParams(when3));

        await scheduler.init();

        const timeouts = schedulerRegistry.getTimeouts();

        expect(timeouts).toContainEqual(id1);
        expect(timeouts).toContainEqual(id2);
        expect(timeouts).not.toContainEqual(id3);
      });

      // eslint-disable-next-line max-len
      it('should not register schedulerRegistry with future messages more than 1 month', async () => {
        const { _id } = await notifyParamsModel.create(generateParams(whenNotInRange));

        await scheduler.init();

        const timeouts = schedulerRegistry.getTimeouts();
        expect(timeouts).not.toContainEqual(_id);
      });
    });

    describe('registerNewMemberNudge', () => {
      afterEach(async () => {
        await clear();
      });

      it('should register schedulerRegistry with all scheduled new member nudge', async () => {
        const { _id: primaryUserId } = await modelUser.create(generateCreateRawUserParams());
        const { _id: orgId } = await modelOrg.create(generateOrgParams());

        const { id: memberId1 } = await service.insert(
          generateCreateMemberParams({ orgId }),
          primaryUserId,
        );
        const { id: memberId2 } = await service.insert(
          generateCreateMemberParams({ orgId }),
          primaryUserId,
        );
        const { id: memberId3 } = await service.insert(
          generateCreateMemberParams({ orgId }),
          primaryUserId,
        );

        await scheduler.init();

        const timeouts = schedulerRegistry.getTimeouts();

        expect(timeouts).toContainEqual(memberId1.toString());
        expect(timeouts).toContainEqual(memberId2.toString());
        expect(timeouts).toContainEqual(memberId3.toString());
      });
    });
  });

  describe('registerCustomFutureNotify', () => {
    afterEach(async () => {
      await clear();
    });

    it('should add a notification params on a new params', async () => {
      const params = [generateParams(), generateParams(), generateParams()];
      const ids = await Promise.all(
        params.map(async (param) => (await scheduler.registerCustomFutureNotify(param)).id),
      );

      const timeouts = schedulerRegistry.getTimeouts();
      ids.map((id) => expect(timeouts).toContainEqual(id));
    });

    it('should not add notification params if metadata.when is > 1 month', async () => {
      const param = generateParams(whenNotInRange);

      const result = await scheduler.registerCustomFutureNotify(param);
      expect(result).toBeUndefined();
    });

    it('should set timeout and check that it occurs and notifying', async () => {
      await scheduler.init();

      //Adding 1 second to scheduler.alertBeforeInMin
      const when = new Date();
      when.setSeconds(when.getSeconds() + 1);
      const param = generateParams(when);

      const { id } = await scheduler.registerCustomFutureNotify(param);
      let timeouts = schedulerRegistry.getTimeouts();
      expect(timeouts).toContainEqual(id);

      await delay(3000);

      timeouts = schedulerRegistry.getTimeouts();
      expect(timeouts).not.toContainEqual(id);
    });
  });

  describe('delete', () => {
    afterEach(async () => {
      await clear();
    });

    it('should not fail on deleting a non existing appointment', async () => {
      await scheduler.deleteTimeout({ id: generateId() });
    });

    it('should delete an existing notification', async () => {
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
