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
import { InternalSchedulerService, LeaderType } from '../../src/scheduler';

describe('MemberScheduler', () => {
  let module: TestingModule;
  let service: MemberService;
  let scheduler: MemberScheduler;
  let notifyParamsModel: Model<typeof NotifyParamsDto>;
  let schedulerRegistry: SchedulerRegistry;
  let modelUser: Model<typeof UserDto>;
  let modelOrg: Model<typeof OrgDto>;
  let internalSchedulerService: InternalSchedulerService;

  const days = (config.get('scheduler.maxAlertGapInMin') + 1) * 60 * 1000;
  const whenNotInRange = new Date();
  whenNotInRange.setMilliseconds(whenNotInRange.getMilliseconds() + days);

  const clear = async () => {
    const timeouts = schedulerRegistry.getTimeouts();
    timeouts.map((timeout) => schedulerRegistry.deleteTimeout(timeout));
    await internalSchedulerService.resetLeader(LeaderType.member);
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    scheduler.amITheLeader = false;
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore

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
    internalSchedulerService = module.get<InternalSchedulerService>(InternalSchedulerService);

    await dbConnect();
    await internalSchedulerService.resetLeader(LeaderType.member);
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

      it('should schedule with all scheduled new member nudge and future', async () => {
        //input for registerCustomFutureNotify
        const whens = [1, 2, -1].map((minutes) => {
          const date = new Date();
          date.setMinutes(date.getMinutes() + minutes);
          return date;
        });
        const ids = await Promise.all(
          whens.map(async (when) => notifyParamsModel.create(generateParams(when))),
        );
        //end input for registerCustomFutureNotify

        //input for initRegisterNewMemberNudge
        const { _id: pId } = await modelUser.create(generateCreateRawUserParams());
        const { _id: orgId } = await modelOrg.create(generateOrgParams());
        const members = await Promise.all(
          [1, 2, 3].map(async () => service.insert(generateCreateMemberParams({ orgId }), pId)),
        );
        //end input for initRegisterNewMemberNudge

        await scheduler.init();

        const timeouts = schedulerRegistry.getTimeouts();

        //timeouts of registerCustomFutureNotify
        expect(timeouts).toContainEqual(ids[0]._id);
        expect(timeouts).toContainEqual(ids[1]._id);
        expect(timeouts).not.toContainEqual(ids[2]._id);
        //timeouts of initRegisterNewMemberNudge
        members.map((member) => expect(timeouts).toContainEqual(member.id.toString()));
      }, 10000);

      // eslint-disable-next-line max-len
      it('should not register schedulerRegistry with future messages more than 1 month', async () => {
        const { _id } = await notifyParamsModel.create(generateParams(whenNotInRange));

        await scheduler.init();
        const timeouts = schedulerRegistry.getTimeouts();
        expect(timeouts).not.toContainEqual(_id);
      }, 10000);

      describe('registerNewRegisteredMemberNotify', () => {
        afterEach(async () => {
          await clear();
        });

        it('should register new registered member notifications', async () => {
          await scheduler.init();

          const newRegisteredMembers = await service.getNewRegisteredMembers({ nudge: false });

          expect(schedulerRegistry.getTimeouts()).toEqual(
            expect.arrayContaining(newRegisteredMembers.map(({ member }) => member.id)),
          );
        }, 10000);
      });

      describe('registerNewRegisteredMemberNudgeNotify', () => {
        afterEach(async () => {
          await clear();
        });

        it('should register new registered member nudge notifications', async () => {
          await scheduler.init();

          const newRegisteredMembers = await service.getNewRegisteredMembers({ nudge: true });

          expect(schedulerRegistry.getTimeouts()).toEqual(
            expect.arrayContaining(newRegisteredMembers.map(({ member }) => member.id)),
          );
        }, 10000);
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
      }, 12000);
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
});
