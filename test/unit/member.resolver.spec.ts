import { Test, TestingModule } from '@nestjs/testing';
import {
  dbDisconnect,
  generateCreateMemberParams,
  generateCreateTaskParams,
  generateMemberLinks,
  generateUpdateTaskStateParams,
  mockGenerateMember,
} from '../../test';
import { DbModule } from '../../src/db/db.module';
import { MemberModule, MemberResolver, MemberService, TaskState } from '../../src/member';
import { Types } from 'mongoose';
import { EventEmitterModule } from '@nestjs/event-emitter';

describe('MemberResolver', () => {
  let module: TestingModule;
  let resolver: MemberResolver;
  let service: MemberService;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [DbModule, MemberModule, EventEmitterModule.forRoot()],
    }).compile();

    resolver = module.get<MemberResolver>(MemberResolver);
    service = module.get<MemberService>(MemberService);
  });

  afterAll(async () => {
    await module.close();
    await dbDisconnect();
  });

  describe('createMember', () => {
    let spyOnServiceInsert;
    beforeEach(() => {
      spyOnServiceInsert = jest.spyOn(service, 'insert');
    });

    afterEach(() => {
      spyOnServiceInsert.mockReset();
    });

    it('should create a member', async () => {
      const member = mockGenerateMember();
      spyOnServiceInsert.mockImplementationOnce(async () => member);

      const params = generateCreateMemberParams({
        orgId: new Types.ObjectId().toString(),
        primaryCoachId: member.primaryCoach.id,
      });
      const links = generateMemberLinks(params.firstName, params.lastName);

      await resolver.createMember(params);

      expect(spyOnServiceInsert).toBeCalledTimes(1);
      expect(spyOnServiceInsert).toBeCalledWith({ createMemberParams: params, ...links });
    });

    it('should support undefined fields', async () => {
      const member = mockGenerateMember();
      spyOnServiceInsert.mockImplementationOnce(async () => member);

      const params = generateCreateMemberParams({
        orgId: new Types.ObjectId().toString(),
        primaryCoachId: member.primaryCoach.id,
      });
      delete params.usersIds;
      const links = generateMemberLinks(params.firstName, params.lastName);
      await resolver.createMember(params);

      expect(spyOnServiceInsert).toBeCalledTimes(1);
      expect(spyOnServiceInsert).toBeCalledWith({ createMemberParams: params, ...links });
    });

    it('should remove user from users list if it is already sent as primaryCoach', async () => {
      const member = mockGenerateMember();
      spyOnServiceInsert.mockImplementationOnce(async () => member);

      const additionalUserId = new Types.ObjectId().toString();
      const params = generateCreateMemberParams({
        deviceId: member.deviceId,
        orgId: new Types.ObjectId().toString(),
        primaryCoachId: member.primaryCoach.id,
        usersIds: [additionalUserId, member.primaryCoach.id],
      });
      const links = generateMemberLinks(params.firstName, params.lastName);

      await resolver.createMember(params);

      expect(spyOnServiceInsert).toBeCalledTimes(1);
      expect(spyOnServiceInsert).toBeCalledWith({
        createMemberParams: {
          deviceId: member.deviceId,
          usersIds: [additionalUserId],
          ...params,
        },
        ...links,
      });
    });
  });

  describe('getMember', () => {
    let spyOnServiceGet;
    beforeEach(() => {
      spyOnServiceGet = jest.spyOn(service, 'get');
    });

    afterEach(() => {
      spyOnServiceGet.mockReset();
    });

    it('should get a member for a given id', async () => {
      const member = mockGenerateMember();
      spyOnServiceGet.mockImplementationOnce(async () => member);

      const result = await resolver.getMember({
        req: {
          headers: {
            /* eslint-disable max-len */
            authorization: `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6InRlc3QifQ.hNQI_r8BATy1LyXPr6Zuo9X_V0kSED8ngcqQ6G-WV5w`,
            /* eslint-enable max-len */
          },
        },
      });

      expect(result).toEqual(member);
    });

    it('should fetch empty on a non valid member', async () => {
      spyOnServiceGet.mockImplementationOnce(async () => null);

      const result = await resolver.getMember({
        req: { headers: { authorization: 'not-valid' } },
      });

      expect(result).toBeNull();
    });
  });

  describe('createGoal', () => {
    let spyOnServiceInsertGoal;
    beforeEach(() => {
      spyOnServiceInsertGoal = jest.spyOn(service, 'insertGoal');
    });

    afterEach(() => {
      spyOnServiceInsertGoal.mockReset();
    });

    it('should create a goal', async () => {
      spyOnServiceInsertGoal.mockImplementationOnce(async () => ({
        id: new Types.ObjectId().toString(),
      }));

      const params = generateCreateTaskParams();
      await resolver.createGoal(params);

      expect(spyOnServiceInsertGoal).toBeCalledTimes(1);
      expect(spyOnServiceInsertGoal).toBeCalledWith({
        createTaskParams: params,
        state: TaskState.pending,
      });
    });
  });

  describe('updateGoalState', () => {
    let spyOnServiceUpdateGoalState;
    beforeEach(() => {
      spyOnServiceUpdateGoalState = jest.spyOn(service, 'updateGoalState');
    });

    afterEach(() => {
      spyOnServiceUpdateGoalState.mockReset();
    });

    it('should create a goal', async () => {
      spyOnServiceUpdateGoalState.mockImplementationOnce(async () => undefined);

      const updateGoalState = { id: new Types.ObjectId().toString(), state: TaskState.reached };
      await resolver.updateGoalState(updateGoalState);

      expect(spyOnServiceUpdateGoalState).toBeCalledTimes(1);
      expect(spyOnServiceUpdateGoalState).toBeCalledWith(updateGoalState);
    });
  });

  describe('createActionItem', () => {
    let spyOnServiceInsertActionItem;
    beforeEach(() => {
      spyOnServiceInsertActionItem = jest.spyOn(service, 'insertActionItem');
    });

    afterEach(() => {
      spyOnServiceInsertActionItem.mockReset();
    });

    it('should create an action item', async () => {
      spyOnServiceInsertActionItem.mockImplementationOnce(async () => ({
        id: new Types.ObjectId().toString(),
      }));

      const params = generateCreateTaskParams();
      await resolver.createActionItem(params);

      expect(spyOnServiceInsertActionItem).toBeCalledTimes(1);
      expect(spyOnServiceInsertActionItem).toBeCalledWith({
        createTaskParams: params,
        state: TaskState.pending,
      });
    });
  });

  describe('updateActionItemState', () => {
    let spyOnServiceUpdateActionItemState;
    beforeEach(() => {
      spyOnServiceUpdateActionItemState = jest.spyOn(service, 'updateActionItemState');
    });

    afterEach(() => {
      spyOnServiceUpdateActionItemState.mockReset();
    });

    it('should create an action item', async () => {
      spyOnServiceUpdateActionItemState.mockImplementationOnce(async () => undefined);

      const updateActionItemState = generateUpdateTaskStateParams();
      await resolver.updateActionItemState(updateActionItemState);

      expect(spyOnServiceUpdateActionItemState).toBeCalledTimes(1);
      expect(spyOnServiceUpdateActionItemState).toBeCalledWith(updateActionItemState);
    });
  });
});
