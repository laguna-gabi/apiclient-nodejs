import { mockLogger, mockProcessWarnings } from '@lagunahealth/pandora';
import { Test, TestingModule } from '@nestjs/testing';
import { Model, model } from 'mongoose';
import { LoggerService } from '../../src/common';
import {
  dbConnect,
  dbDisconnect,
  defaultModules,
  generateCreateRedFlagParams,
  generateId,
} from '../index';
import { CareModule, CareService, RedFlag, RedFlagDto } from '../../src/care';

describe('CareService', () => {
  let module: TestingModule;
  let service: CareService;
  let redFlagModel: Model<typeof RedFlagDto>;

  beforeAll(async () => {
    mockProcessWarnings(); // to hide pino prettyPrint warning
    module = await Test.createTestingModule({
      imports: defaultModules().concat(CareModule),
    }).compile();

    service = module.get<CareService>(CareService);
    mockLogger(module.get<LoggerService>(LoggerService));
    redFlagModel = model(RedFlag.name, RedFlagDto);
    await dbConnect();
  });

  afterAll(async () => {
    await module.close();
    await dbDisconnect();
  });

  describe('RedFlag', () => {
    it('should create a red flag', async () => {
      const params = generateCreateRedFlagParams({ createdBy: generateId() });
      const { id } = await service.createRedFlag(params);

      const result: any = await redFlagModel.findById(id);
      result.memberId = result.memberId.toString();
      result.createdBy = result.createdBy.toString();
      expect(result).toEqual(expect.objectContaining(params));
    });

    it('should get multiple red flags by memberId', async () => {
      const memberId = generateId();
      const params = generateCreateRedFlagParams({ memberId, createdBy: generateId() });
      await service.createRedFlag(params);
      const params2 = generateCreateRedFlagParams({ memberId, createdBy: generateId() });
      await service.createRedFlag(params2);

      const result: any = await service.getMemberRedFlags(memberId);
      result[0].memberId = result[0].memberId.toString();
      result[0].createdBy = result[0].createdBy.toString();
      expect(result[0]).toEqual(expect.objectContaining(params));

      result[1].memberId = result[1].memberId.toString();
      result[1].createdBy = result[1].createdBy.toString();
      expect(result[1]).toEqual(expect.objectContaining(params2));
    });

    it('should return empty list when there are no red flags for member', async () => {
      await service.createRedFlag(generateCreateRedFlagParams({ createdBy: generateId() }));
      const result: any = await service.getMemberRedFlags(generateId());
      expect(result).toEqual([]);
    });
  });
});
