import { Test, TestingModule } from '@nestjs/testing';
import { DbModule } from '../../src/db/db.module';

describe('SettingsService', () => {
  let module: TestingModule;

  beforeAll(async () => {
    module = await Test.createTestingModule({ imports: [DbModule] }).compile();
  });

  afterAll(async () => {
    await module.close();
  });

  describe('MemberSettings', () => {
    it('should do something', async () => {
      console.log('hopa');
    });
  });
});
