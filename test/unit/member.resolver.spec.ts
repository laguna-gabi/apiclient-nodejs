import { Test, TestingModule } from '@nestjs/testing';
import {
  mockGenerateMember,
  generateCreateMemberParams,
  dbDisconnect,
} from '../../test';
import { DbModule } from '../../src/db/db.module';
import { MemberResolver, MemberService, MemberModule } from '../../src/member';
import { ObjectID } from 'bson';

describe('MemberResolver', () => {
  let module: TestingModule;
  let resolver: MemberResolver;
  let service: MemberService;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [DbModule, MemberModule],
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
        primaryCoachId: member.primaryCoach.id,
      });
      await resolver.createMember(params);

      expect(spyOnServiceInsert).toBeCalledTimes(1);
      expect(spyOnServiceInsert).toBeCalledWith(params);
    });

    it('should support undefined fields', async () => {
      const member = mockGenerateMember();
      spyOnServiceInsert.mockImplementationOnce(async () => member);

      const params = generateCreateMemberParams({
        primaryCoachId: member.primaryCoach.id,
      });
      delete params.usersIds;
      await resolver.createMember(params);

      expect(spyOnServiceInsert).toBeCalledTimes(1);
      expect(spyOnServiceInsert).toBeCalledWith(params);
    });

    it('should remove user from users list if it is already sent as primaryCoach', async () => {
      const member = mockGenerateMember();
      spyOnServiceInsert.mockImplementationOnce(async () => member);

      const additionalUserId = new ObjectID().toString();
      const params = generateCreateMemberParams({
        primaryCoachId: member.primaryCoach.id,
        usersIds: [additionalUserId, member.primaryCoach.id],
      });

      await resolver.createMember(params);

      expect(spyOnServiceInsert).toBeCalledTimes(1);
      expect(spyOnServiceInsert).toBeCalledWith({
        phoneNumber: params.phoneNumber,
        name: params.name,
        dateOfBirth: params.dateOfBirth,
        primaryCoachId: params.primaryCoachId,
        usersIds: [additionalUserId],
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

      const result = await resolver.getMember(member.id);

      expect(result).toEqual(member);
    });

    it('should fetch empty on a non existing user', async () => {
      spyOnServiceGet.mockImplementationOnce(async () => null);

      const id = new ObjectID();
      const result = await resolver.getMember(id.toString());

      expect(result).toBeNull();
    });
  });
});
