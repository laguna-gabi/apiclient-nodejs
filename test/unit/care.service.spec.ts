import { mockLogger, mockProcessWarnings } from '@lagunahealth/pandora';
import { Test, TestingModule } from '@nestjs/testing';
import { LoggerService } from '../../src/common';
import {
  dbConnect,
  dbDisconnect,
  defaultModules,
  generateCreateBarrierParams,
  generateCreateRedFlagParams,
  generateId,
  generateUpdateBarrierParams,
} from '../index';
import { CareModule, CareService, CareStatus } from '../../src/care';

describe('CareService', () => {
  let module: TestingModule;
  let service: CareService;

  beforeAll(async () => {
    mockProcessWarnings(); // to hide pino prettyPrint warning
    module = await Test.createTestingModule({
      imports: defaultModules().concat(CareModule),
    }).compile();

    service = module.get<CareService>(CareService);
    mockLogger(module.get<LoggerService>(LoggerService));
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

      const result: any = await service.getRedFlag(id);
      result.memberId = result.memberId.toString();
      result.createdBy = result.createdBy.toString();
      expect(result).toEqual(expect.objectContaining(params));
    });

    it('should get multiple red flags by memberId', async () => {
      const memberId = generateId();
      const params = generateCreateRedFlagParams({ memberId, createdBy: generateId() });
      const { id } = await service.createRedFlag(params);
      const params2 = generateCreateRedFlagParams({ memberId, createdBy: generateId() });
      const { id: id2 } = await service.createRedFlag(params2);

      const redFlag = await service.getRedFlag(id);
      const redFlag2 = await service.getRedFlag(id2);
      const result: any = await service.getMemberRedFlags(memberId);
      expect(result).toEqual([redFlag, redFlag2]);
    });

    it('should return empty list when there are no red flags for member', async () => {
      const result: any = await service.getMemberRedFlags(generateId());
      expect(result).toEqual([]);
    });
  });

  describe('Barrier', () => {
    it('should create a barrier', async () => {
      const params = generateCreateBarrierParams({ createdBy: generateId() });
      const { id } = await service.createBarrier(params);

      const result: any = await service.getBarrier(id);
      result.memberId = result.memberId.toString();
      result.createdBy = result.createdBy.toString();
      result.redFlagId = result.redFlagId.toString();
      expect(result).toEqual(expect.objectContaining(params));
      expect(result.status).toEqual(CareStatus.active);
    });

    it('should get multiple barriers by memberId', async () => {
      const memberId = generateId();
      const params = generateCreateBarrierParams({ memberId, createdBy: generateId() });
      const { id } = await service.createBarrier(params);
      const params2 = generateCreateBarrierParams({ memberId, createdBy: generateId() });
      const { id: id2 } = await service.createBarrier(params2);

      const barrier = await service.getBarrier(id);
      const barrier2 = await service.getBarrier(id2);
      const result: any = await service.getMemberBarriers(memberId);
      expect(result).toEqual([barrier, barrier2]);
    });

    it('should update barriers and set completedAt', async () => {
      const params = generateCreateBarrierParams({
        memberId: generateId(),
        createdBy: generateId(),
      });
      const { id } = await service.createBarrier(params);
      const barrierBefore: any = await service.getBarrier(id);
      expect(barrierBefore.completedAt).toBeUndefined();

      const updateParams = generateUpdateBarrierParams({ id });

      const result: any = await service.updateBarrier(updateParams);
      expect(result.status).toEqual(updateParams.status);
      expect(result.notes).toEqual(updateParams.notes);
      expect(result.completedAt).toEqual(expect.any(Date));
    });

    test.each(['notes', 'status'])(
      'should not override optional field %p when not set from params',
      async (param) => {
        const params = generateCreateBarrierParams({
          memberId: generateId(),
          createdBy: generateId(),
        });
        const { id } = await service.createBarrier(params);
        const barrierBefore: any = await service.getBarrier(id);
        expect(barrierBefore.completedAt).toBeUndefined();

        const updateParams = generateUpdateBarrierParams({ id });
        delete updateParams[param];

        const result: any = await service.updateBarrier(updateParams);
        expect(result.id).toEqual(id);
        expect(result[param]).toEqual(barrierBefore[param]);
        if (param !== 'status') {
          // should update completedAt only when status is set to completed
          expect(result.completedAt).toEqual(expect.any(Date));
        } else {
          expect(result.completedAt).toBeUndefined();
        }
      },
    );

    it('should return empty list when there are no barriers for member', async () => {
      const result: any = await service.getMemberBarriers(generateId());
      expect(result).toEqual([]);
    });
  });
});
