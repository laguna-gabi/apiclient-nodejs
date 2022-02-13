import { mockLogger, mockProcessWarnings } from '@lagunahealth/pandora';
import { Test, TestingModule } from '@nestjs/testing';
import { LoggerService } from '../../src/common';
import { dbDisconnect, defaultModules, generateCreateRedFlagParams, generateId } from '../index';
import { CareModule, CareResolver, CareService } from '../../src/care';
import { redFlags } from '../../src/care/redFlags.json';

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
    let spyOnServiceDeleteRedFlags;

    beforeEach(() => {
      spyOnServiceCreateRedFlag = jest.spyOn(service, 'createRedFlag');
      spyOnServiceGetMemberRedFlags = jest.spyOn(service, 'getMemberRedFlags');
      spyOnServiceDeleteRedFlags = jest.spyOn(service, 'deleteRedFlag');
      spyOnServiceCreateRedFlag.mockImplementationOnce(async () => undefined);
      spyOnServiceDeleteRedFlags.mockImplementationOnce(async () => true);
    });

    afterEach(() => {
      spyOnServiceCreateRedFlag.mockReset();
      spyOnServiceGetMemberRedFlags.mockReset();
      spyOnServiceDeleteRedFlags.mockReset();
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

    it('should delete a red flag', async () => {
      const userId = generateId();
      const id = generateId();
      const result = await resolver.deleteRedFlag(userId, id);
      expect(result).toBeTruthy();

      expect(spyOnServiceDeleteRedFlags).toBeCalledTimes(1);
      expect(spyOnServiceDeleteRedFlags).toBeCalledWith(id, userId);
    });

    it('should get all redFlagTypes', async () => {
      const result = await resolver.getRedFlagTypes();
      expect(result).toEqual(redFlags);
    });
  });
});
