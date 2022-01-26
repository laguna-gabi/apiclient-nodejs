import { mockLogger, mockProcessWarnings } from '@lagunahealth/pandora';
import { Test, TestingModule } from '@nestjs/testing';
import { LoggerService } from '../../src/common';
import {
  checkDelete,
  dbConnect,
  dbDisconnect,
  defaultModules,
  generateCreateBarrierParams,
  generateCreateCarePlanParams,
  generateCreateRedFlagParams,
  generateId,
  generateUpdateBarrierParams,
  generateUpdateCarePlanParams,
  randomEnum,
} from '../index';
import {
  CareModule,
  CarePlanType,
  CareService,
  CareStatus,
  RedFlag,
  RedFlagDocument,
  RedFlagDto,
} from '../../src/care';
import { Model, Types, model } from 'mongoose';
import { lorem } from 'faker';

describe('CareService', () => {
  let module: TestingModule;
  let service: CareService;
  let redFlagModel: Model<RedFlagDocument>;

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

      const result = await service.getRedFlag(id);
      expect(result).toEqual(
        expect.objectContaining({
          ...params,
          memberId: new Types.ObjectId(params.memberId),
          createdBy: new Types.ObjectId(params.createdBy),
        }),
      );
    });

    it('should get multiple red flags by memberId', async () => {
      const memberId = generateId();
      const params = generateCreateRedFlagParams({ memberId, createdBy: generateId() });
      const { id } = await service.createRedFlag(params);
      const params2 = generateCreateRedFlagParams({ memberId, createdBy: generateId() });
      const { id: id2 } = await service.createRedFlag(params2);

      const redFlag = await service.getRedFlag(id);
      const redFlag2 = await service.getRedFlag(id2);
      const result = await service.getMemberRedFlags(memberId);
      expect(result).toEqual([redFlag, redFlag2]);
    });

    it('should return empty list when there are no red flags for member', async () => {
      const result = await service.getMemberRedFlags(generateId());
      expect(result).toEqual([]);
    });

    it('should delete a red flag', async () => {
      const userId = generateId();
      const params = generateCreateRedFlagParams({
        memberId: generateId(),
        createdBy: generateId(),
      });
      const { id } = await service.createRedFlag(params);

      const redFlagBefore = await service.getRedFlag(id);
      expect(redFlagBefore.id).toEqual(id);

      const result = await service.deleteRedFlag(id, userId);
      expect(result).toBeTruthy();
      const redFlagAfter = await service.getRedFlag(id);
      expect(redFlagAfter).toBeNull();

      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const deletedResult = await redFlagModel.findWithDeleted(new Types.ObjectId(id));
      await checkDelete(deletedResult, new Types.ObjectId(id), userId);
    });

    // eslint-disable-next-line max-len
    it('should delete redFlagId references from child barriers when deleting a red flag', async () => {
      const memberId = generateId();
      // create red flags
      const createRedFlagParams = generateCreateRedFlagParams({
        memberId,
        createdBy: generateId(),
      });
      const { id: redFlagId } = await service.createRedFlag(createRedFlagParams);
      // create barrier related to the red flag
      const createBarrierParams = generateCreateBarrierParams({
        createdBy: generateId(),
        redFlagId,
        memberId,
      });
      await service.createBarrier(createBarrierParams);

      // create independent barrier (not related to the red flag)
      const createBarrierParams2 = generateCreateBarrierParams({
        createdBy: generateId(),
        memberId,
      });
      await service.createBarrier(createBarrierParams2);

      const redFlagsBefore = await service.getMemberRedFlags(memberId);
      expect(redFlagsBefore.length).toEqual(1);
      const barriersBefore = await service.getMemberBarriers(memberId);
      expect(barriersBefore.length).toEqual(2);
      expect(barriersBefore).toEqual([
        expect.objectContaining({ redFlagId: new Types.ObjectId(redFlagId) }),
        expect.not.objectContaining({ redFlagId: new Types.ObjectId(redFlagId) }),
      ]);

      const deleteResult = await service.deleteRedFlag(redFlagId, generateId());
      expect(deleteResult).toBeTruthy();

      const redFlagsAfter = await service.getMemberRedFlags(memberId);
      expect(redFlagsAfter.length).toEqual(0);
      const barriersAfter = await service.getMemberBarriers(memberId);
      expect(barriersAfter.length).toEqual(2);
      expect(barriersAfter).toEqual([
        expect.not.objectContaining({ redFlagId: new Types.ObjectId(redFlagId) }),
        expect.not.objectContaining({ redFlagId: new Types.ObjectId(redFlagId) }),
      ]);
    });

    it('should not get deleted red flags on getMemberRedFlags', async () => {
      const memberId = generateId();
      const params = generateCreateRedFlagParams({ memberId, createdBy: generateId() });
      const { id } = await service.createRedFlag(params);
      const params2 = generateCreateRedFlagParams({ memberId, createdBy: generateId() });
      const { id: id2 } = await service.createRedFlag(params2);

      const deleteResult = await service.deleteRedFlag(id2, generateId());
      expect(deleteResult).toBeTruthy();

      const redFlag = await service.getRedFlag(id);
      const result = await service.getMemberRedFlags(memberId);
      expect(result).toEqual([redFlag]);
    });
  });

  describe('Barrier', () => {
    it('should create a barrier', async () => {
      const params = generateCreateBarrierParams({ createdBy: generateId() });
      const { id } = await service.createBarrier(params);

      const result = await service.getBarrier(id);
      expect(result).toEqual(
        expect.objectContaining({
          ...params,
          status: CareStatus.active,
          memberId: new Types.ObjectId(params.memberId),
          createdBy: new Types.ObjectId(params.createdBy),
          redFlagId: new Types.ObjectId(params.redFlagId),
        }),
      );
    });

    it('should get multiple barriers by memberId', async () => {
      const memberId = generateId();
      const params = generateCreateBarrierParams({ memberId, createdBy: generateId() });
      const { id } = await service.createBarrier(params);
      const params2 = generateCreateBarrierParams({ memberId, createdBy: generateId() });
      const { id: id2 } = await service.createBarrier(params2);

      const barrier = await service.getBarrier(id);
      const barrier2 = await service.getBarrier(id2);
      const result = await service.getMemberBarriers(memberId);
      expect(result).toEqual([barrier, barrier2]);
    });

    it('should update barriers and set completedAt', async () => {
      const params = generateCreateBarrierParams({
        memberId: generateId(),
        createdBy: generateId(),
      });
      const { id } = await service.createBarrier(params);
      const barrierBefore = await service.getBarrier(id);
      expect(barrierBefore.completedAt).toBeUndefined();

      const updateParams = generateUpdateBarrierParams({ id });

      const result = await service.updateBarrier(updateParams);
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
        const barrierBefore = await service.getBarrier(id);
        expect(barrierBefore.completedAt).toBeUndefined();

        const updateParams = generateUpdateBarrierParams({ id });
        delete updateParams[param];

        const result = await service.updateBarrier(updateParams);
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
      const result = await service.getMemberBarriers(generateId());
      expect(result).toEqual([]);
    });
  });

  describe('CarePlan', () => {
    test.each`
      title          | param
      ${'suggested'} | ${{ carePlanType: randomEnum(CarePlanType) as CarePlanType }}
      ${'custom'}    | ${{ customValue: lorem.words(4) }}
    `(`should create a $title care plan`, async (params) => {
      const createCarePlanParams = generateCreateCarePlanParams({
        createdBy: generateId(),
        ...params.param,
      });
      const { id } = await service.createCarePlan(createCarePlanParams);

      const result = await service.getCarePlan(id);
      expect(result).toEqual(
        expect.objectContaining({
          ...createCarePlanParams,
          status: CareStatus.active,
          memberId: new Types.ObjectId(createCarePlanParams.memberId),
          createdBy: new Types.ObjectId(createCarePlanParams.createdBy),
          barrierId: new Types.ObjectId(createCarePlanParams.barrierId),
        }),
      );
    });

    it('should get multiple care plans by memberId', async () => {
      const memberId = generateId();
      const params = generateCreateCarePlanParams({
        memberId,
        createdBy: generateId(),
        carePlanType: CarePlanType.temporary1,
      });
      const { id } = await service.createCarePlan(params);
      const params2 = generateCreateCarePlanParams({
        memberId,
        createdBy: generateId(),
        carePlanType: CarePlanType.temporary2,
      });
      const { id: id2 } = await service.createCarePlan(params2);

      const carePlan = await service.getCarePlan(id);
      const carePlan2 = await service.getCarePlan(id2);
      const result = await service.getMemberCarePlans(memberId);
      expect(result).toEqual([carePlan, carePlan2]);
    });

    it('should update care plans and set completedAt', async () => {
      const params = generateCreateCarePlanParams({
        memberId: generateId(),
        createdBy: generateId(),
        carePlanType: CarePlanType.temporary1,
      });
      const { id } = await service.createCarePlan(params);
      const carePlanBefore = await service.getCarePlan(id);
      expect(carePlanBefore.completedAt).toBeUndefined();

      const updateParams = generateUpdateCarePlanParams({ id });
      const result = await service.updateCarePlan(updateParams);
      expect(result.status).toEqual(updateParams.status);
      expect(result.notes).toEqual(updateParams.notes);
      expect(result.completedAt).toEqual(expect.any(Date));
    });

    test.each(['notes', 'status'])(
      'should not override optional field %p when not set from params',
      async (param) => {
        const params = generateCreateCarePlanParams({
          memberId: generateId(),
          createdBy: generateId(),
          carePlanType: CarePlanType.temporary1,
        });
        const { id } = await service.createCarePlan(params);
        const carePlanBefore = await service.getCarePlan(id);
        expect(carePlanBefore.completedAt).toBeUndefined();

        const updateParams = generateUpdateCarePlanParams({ id });
        delete updateParams[param];

        const result = await service.updateCarePlan(updateParams);
        expect(result.id).toEqual(id);
        expect(result[param]).toEqual(carePlanBefore[param]);
        if (param !== 'status') {
          // should update completedAt only when status is set to completed
          expect(result.completedAt).toEqual(expect.any(Date));
        } else {
          expect(result.completedAt).toBeUndefined();
        }
      },
    );

    it('should return empty list when there are no care plans for member', async () => {
      const result = await service.getMemberCarePlans(generateId());
      expect(result).toEqual([]);
    });
  });
});
