import { mockLogger, mockProcessWarnings } from '@lagunahealth/pandora';
import { Test, TestingModule } from '@nestjs/testing';
import { LoggerService } from '../../src/common';
import { dbDisconnect, defaultModules, generateCreateRedFlagParams, generateId } from '../index';
import { CareModule, CareResolver, CareService } from '../../src/care';

describe('CareResolver', () => {
  let module: TestingModule;
  let service: CareService;
  let resolver: CareResolver;

  beforeAll(async () => {
    mockProcessWarnings(); // to hide pino prettyPrint warning
    module = await Test.createTestingModule({
      imports: defaultModules().concat(CareModule),
    }).compile();

    resolver = module.get<CareResolver>(CareResolver);
    service = module.get<CareService>(CareService);
    mockLogger(module.get<LoggerService>(LoggerService));
  });

  afterAll(async () => {
    await module.close();
    await dbDisconnect();
  });

  describe('RedFlag', () => {
    let spyOnServiceCreateRedFlag;
    let spyOnServiceGetMemberRedFlags;
    beforeEach(() => {
      spyOnServiceCreateRedFlag = jest.spyOn(service, 'createRedFlag');
      spyOnServiceGetMemberRedFlags = jest.spyOn(service, 'getMemberRedFlags');
      spyOnServiceCreateRedFlag.mockImplementationOnce(async () => undefined);
    });

    afterEach(() => {
      spyOnServiceCreateRedFlag.mockReset();
      spyOnServiceGetMemberRedFlags.mockReset();
    });

    it('should create a red flag', async () => {
      const params = generateCreateRedFlagParams();
      const userId = generateId();
      await resolver.createRedFlag(userId, params);

      expect(spyOnServiceCreateRedFlag).toBeCalledTimes(1);
      expect(spyOnServiceCreateRedFlag).toBeCalledWith({ ...params, createdBy: userId });
    });

    it('should get red flags by memberId', async () => {
      const memberId = generateId();
      await resolver.getMemberRedFlags(memberId);

      expect(spyOnServiceGetMemberRedFlags).toBeCalledTimes(1);
      expect(spyOnServiceGetMemberRedFlags).toBeCalledWith(memberId);
    });
  });
});
