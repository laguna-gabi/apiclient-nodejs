import { Test, TestingModule } from '@nestjs/testing';
import { mockGenerateMember, generateCreateMemberParams } from '../../test';
import { DbModule } from '../../src/db/db.module';
import { MemberResolver } from '../../src/member/member.resolver';
import { MemberService } from '../../src/member/member.service';
import { MemberModule } from '../../src/member/member.module';
import { ObjectID } from 'bson';

describe('MemberResolver', () => {
  let resolver: MemberResolver;
  let service: MemberService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [DbModule, MemberModule],
    }).compile();

    resolver = module.get<MemberResolver>(MemberResolver);
    service = module.get<MemberService>(MemberService);
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

      const params = generateCreateMemberParams(member.primaryCoach._id);
      await resolver.createMember(params);

      expect(spyOnServiceInsert).toBeCalledTimes(1);
      expect(spyOnServiceInsert).toBeCalledWith(params);
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
        id: member._id,
      });

      expect(result).toEqual(member);
    });

    it('should fetch empty on a non existing coach', async () => {
      spyOnServiceGet.mockImplementationOnce(async () => null);

      const id = new ObjectID();
      const result = await resolver.getMember({
        id: id.toString(),
      });

      expect(result).toBeNull();
    });
  });
});
