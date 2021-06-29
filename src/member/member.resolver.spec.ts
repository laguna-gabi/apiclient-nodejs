import { Test, TestingModule } from '@nestjs/testing';
import { DbModule } from '../db/db.module';
import { MemberResolver } from './member.resolver';
import { MemberModule } from './member.module';

describe('MemberResolver', () => {
  let resolver: MemberResolver;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [MemberModule, DbModule],
    }).compile();

    resolver = module.get<MemberResolver>(MemberResolver);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });

  describe('connect', () => {
    it('should fail to connect on non existing member id', async () => {
      await resolver.getMember({ id: '60d45b694f923f9e019b27e9' });
    });
  });
});
