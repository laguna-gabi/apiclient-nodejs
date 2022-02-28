import { mockLogger, mockProcessWarnings } from '@lagunahealth/pandora';
import { Test, TestingModule } from '@nestjs/testing';
import { ErrorType, Errors, LoggerService } from '../../src/common';
import {
  dbConnect,
  dbDisconnect,
  defaultModules,
  generateCarePlanTypeInput,
  generateCreateBarrierParams,
  generateCreateCarePlanParams,
  generateCreateRedFlagParams,
  generateId,
  generateUpdateBarrierParams,
  generateUpdateCarePlanParams,
  generateUpdateRedFlagParams,
  randomEnum,
} from '../index';
import {
  BarrierDomain,
  BarrierType,
  BarrierTypeDocument,
  BarrierTypeDto,
  CareModule,
  CareService,
  CareStatus,
} from '../../src/care';
import { Model, Types, model } from 'mongoose';
import { lorem } from 'faker';

describe('CareService', () => {
  let module: TestingModule;
  let service: CareService;
  let barrierTypeModel: Model<BarrierTypeDocument>;

  beforeAll(async () => {
    mockProcessWarnings(); // to hide pino prettyPrint warning
    module = await Test.createTestingModule({
      imports: defaultModules().concat(CareModule),
    }).compile();

    service = module.get<CareService>(CareService);
    mockLogger(module.get<LoggerService>(LoggerService));
    barrierTypeModel = model<BarrierTypeDocument>(BarrierType.name, BarrierTypeDto);
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

    it('should update a red flag', async () => {
      const memberId = generateId();
      const params = generateCreateRedFlagParams({ memberId, createdBy: generateId() });
      const { id } = await service.createRedFlag(params);

      const updateParams = generateUpdateRedFlagParams({ id });
      const result = await service.updateRedFlag(updateParams);
      expect(result.notes).toEqual(updateParams.notes);
    });
  });

  describe('Barrier', () => {
    it('should create a barrier', async () => {
      const memberId = generateId();
      const redFlagId = await generateRedFlag(memberId);
      const type = await generateBarrierType();
      const params = generateCreateBarrierParams({
        createdBy: generateId(),
        memberId,
        redFlagId,
        type: type,
      });
      const { id } = await service.createBarrier(params);

      const result = await service.getBarrier(id);
      expect(result).toEqual(
        expect.objectContaining({
          ...params,
          status: CareStatus.active,
          memberId: new Types.ObjectId(memberId),
          createdBy: new Types.ObjectId(params.createdBy),
          redFlagId: new Types.ObjectId(redFlagId),
          type: new Types.ObjectId(type),
        }),
      );
    });

    it('should fail to create a barrier with a wrong barrier type', async () => {
      const memberId = generateId();
      const redFlagId = await generateRedFlag(memberId);
      const params = generateCreateBarrierParams({
        createdBy: generateId(),
        memberId,
        redFlagId,
        type: generateId(),
      });
      await expect(service.createBarrier(params)).rejects.toThrow(
        Error(Errors.get(ErrorType.barrierTypeNotFound)),
      );
    });

    it('should fail to create a barrier with a wrong redFlagId', async () => {
      const memberId = generateId();
      const type = await generateBarrierType();
      const params = generateCreateBarrierParams({
        createdBy: generateId(),
        memberId,
        redFlagId: generateId(),
        type: type,
      });
      await expect(service.createBarrier(params)).rejects.toThrow(
        Error(Errors.get(ErrorType.redFlagNotFound)),
      );
    });

    it('should fail to create a barrier with an inconsistent memberId', async () => {
      const redFlagId = await generateRedFlag();
      const type = await generateBarrierType();
      const params = generateCreateBarrierParams({
        createdBy: generateId(),
        memberId: generateId(),
        redFlagId,
        type: type,
      });
      await expect(service.createBarrier(params)).rejects.toThrow(
        Error(Errors.get(ErrorType.memberIdInconsistent)),
      );
    });

    it('should get multiple barriers by memberId', async () => {
      const memberId = generateId();
      const redFlagId = await generateRedFlag(memberId);
      const type = await generateBarrierType();
      const params = generateCreateBarrierParams({
        memberId,
        createdBy: generateId(),
        redFlagId,
        type,
      });
      const { id } = await service.createBarrier(params);
      const params2 = generateCreateBarrierParams({
        memberId,
        createdBy: generateId(),
        redFlagId,
        type,
      });
      const { id: id2 } = await service.createBarrier(params2);

      const result = await service.getMemberBarriers(memberId);
      expect(result).toEqual([
        expect.objectContaining({
          ...params,
          status: CareStatus.active,
          memberId: new Types.ObjectId(memberId),
          createdBy: new Types.ObjectId(params.createdBy),
          redFlagId: new Types.ObjectId(redFlagId),
          type: expect.objectContaining({ _id: new Types.ObjectId(type) }),
          id,
        }),
        expect.objectContaining({
          ...params2,
          status: CareStatus.active,
          memberId: new Types.ObjectId(memberId),
          createdBy: new Types.ObjectId(params2.createdBy),
          redFlagId: new Types.ObjectId(redFlagId),
          type: expect.objectContaining({ _id: new Types.ObjectId(type) }),
          id: id2,
        }),
      ]);
    });

    it('should update barriers and set completedAt', async () => {
      const memberId = generateId();
      const redFlagId = await generateRedFlag(memberId);
      const type = await generateBarrierType();
      const params = generateCreateBarrierParams({
        memberId,
        createdBy: generateId(),
        redFlagId,
        type,
      });
      const { id } = await service.createBarrier(params);
      const barrierBefore = await service.getBarrier(id);
      expect(barrierBefore.completedAt).toBeUndefined();

      const type2 = await generateBarrierType();
      const updateParams = generateUpdateBarrierParams({ id, type: type2 });

      const result = await service.updateBarrier(updateParams);
      expect(result.status).toEqual(updateParams.status);
      expect(result.notes).toEqual(updateParams.notes);
      expect(result.type.toString()).toEqual(updateParams.type);
      expect(result.completedAt).toEqual(expect.any(Date));
    });

    test.each(['notes', 'status', 'type'])(
      'should not override optional field %p when not set from params',
      async (param) => {
        const memberId = generateId();
        const redFlagId = await generateRedFlag(memberId);
        const type = await generateBarrierType();
        const params = generateCreateBarrierParams({
          memberId,
          createdBy: generateId(),
          redFlagId,
          type,
        });
        const { id } = await service.createBarrier(params);
        const barrierBefore = await service.getBarrier(id);
        expect(barrierBefore.completedAt).toBeUndefined();

        const type2 = await generateBarrierType();
        const updateParams = generateUpdateBarrierParams({ id, type: type2 });
        delete updateParams[param];

        const result = await service.updateBarrier(updateParams);
        expect(result.id).toEqual(id);
        expect(result[param]).toEqual(barrierBefore[param]);
        if (param === 'status') {
          expect(result.completedAt).toBeUndefined();
        } else {
          // should update completedAt only when status is set to completed
          expect(result.completedAt).toEqual(expect.any(Date));
        }
      },
    );

    it('should return empty list when there are no barriers for member', async () => {
      const result = await service.getMemberBarriers(generateId());
      expect(result).toEqual([]);
    });

    it('should get all barrierTypes', async () => {
      const carePlanType = await generateCarePlanType();
      const carePlanType2 = await generateCarePlanType();
      const desc = lorem.words(4);
      const desc2 = lorem.words(4);
      const id = await generateBarrierType(desc, BarrierDomain.behavior, [carePlanType]);
      const id2 = await generateBarrierType(desc2, BarrierDomain.logistical, [carePlanType2]);
      const barrierType = await service.getBarrierType(id);
      const barrierType2 = await service.getBarrierType(id2);

      const result = await service.getBarrierTypes();
      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: barrierType.id,
            description: barrierType.description,
            domain: BarrierDomain.behavior,
            carePlanTypes: expect.arrayContaining([
              expect.objectContaining({ _id: new Types.ObjectId(carePlanType) }),
            ]),
          }),
          expect.objectContaining({
            id: barrierType2.id,
            description: barrierType2.description,
            domain: BarrierDomain.logistical,
            carePlanTypes: expect.arrayContaining([
              expect.objectContaining({ _id: new Types.ObjectId(carePlanType2) }),
            ]),
          }),
        ]),
      );
    });

    it('should create and get barrierType', async () => {
      const carePlanType = await generateCarePlanType();
      const description = lorem.words(4);

      const { id } = await barrierTypeModel.create({
        description,
        domain: BarrierDomain.medical,
        carePlanTypes: [carePlanType],
      });
      const result = await service.getBarrierType(id);

      expect(result.id).toEqual(id.toString());
      expect(result.description).toEqual(description);
      expect(result.domain).toEqual(BarrierDomain.medical);
      expect(result.carePlanTypes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ _id: new Types.ObjectId(carePlanType) }),
        ]),
      );
    });
  });

  describe('CarePlan', () => {
    it('should create a custom care plan', async () => {
      const memberId = generateId();
      const barrierId = await generateBarrier(memberId);
      const custom = lorem.words(4);
      const carePlanTypeInput = generateCarePlanTypeInput({ custom });
      const params = generateCreateCarePlanParams({
        createdBy: generateId(),
        type: carePlanTypeInput,
        barrierId,
        memberId,
      });
      const { id } = await service.createCarePlan(params);

      const result = await service.getCarePlan(id);
      const carePlanType = await service.getCarePlanType(result.type.toString());
      expect(carePlanType).toEqual(
        expect.objectContaining({
          createdBy: new Types.ObjectId(params.createdBy),
          description: custom,
          isCustom: true,
        }),
      );

      delete params.type;
      expect(result).toEqual(
        expect.objectContaining({
          ...params,
          status: CareStatus.active,
          memberId: new Types.ObjectId(params.memberId),
          createdBy: new Types.ObjectId(params.createdBy),
          barrierId: new Types.ObjectId(params.barrierId),
        }),
      );
    });

    it('should create a care plan with a specific type', async () => {
      const memberId = generateId();
      const barrierId = await generateBarrier(memberId);
      const carePlanTypeId = await generateCarePlanType();
      const carePlanTypeInput = generateCarePlanTypeInput({ id: carePlanTypeId });
      const params = generateCreateCarePlanParams({
        createdBy: generateId(),
        type: carePlanTypeInput,
        barrierId,
        memberId,
      });
      const { id } = await service.createCarePlan(params);
      const result = await service.getCarePlan(id);

      delete params.type;
      expect(result).toEqual(
        expect.objectContaining({
          ...params,
          status: CareStatus.active,
          memberId: new Types.ObjectId(params.memberId),
          createdBy: new Types.ObjectId(params.createdBy),
          barrierId: new Types.ObjectId(params.barrierId),
          type: new Types.ObjectId(carePlanTypeId),
        }),
      );
    });

    it('should fail to create a care plan with a wrong care plan type', async () => {
      const memberId = generateId();
      const barrierId = await generateBarrier(memberId);

      const params = generateCreateCarePlanParams({
        createdBy: generateId(),
        barrierId,
        memberId,
        type: generateCarePlanTypeInput({ id: generateId() }),
      });

      await expect(service.createCarePlan(params)).rejects.toThrow(
        Error(Errors.get(ErrorType.carePlanTypeNotFound)),
      );
    });

    it('should fail to create a care plan with a wrong barrierId', async () => {
      const carePlanTypeId = await generateCarePlanType();
      const carePlanTypeInput = generateCarePlanTypeInput({ id: carePlanTypeId });
      const params = generateCreateCarePlanParams({
        createdBy: generateId(),
        barrierId: generateId(),
        type: carePlanTypeInput,
      });

      await expect(service.createCarePlan(params)).rejects.toThrow(
        Error(Errors.get(ErrorType.barrierNotFound)),
      );
    });

    it('should fail to create a care plan with an inconsistent memberId', async () => {
      const barrierId = await generateBarrier();
      const carePlanTypeId = await generateCarePlanType();
      const carePlanTypeInput = generateCarePlanTypeInput({ id: carePlanTypeId });
      const params = generateCreateCarePlanParams({
        createdBy: generateId(),
        barrierId,
        type: carePlanTypeInput,
      });

      await expect(service.createCarePlan(params)).rejects.toThrow(
        Error(Errors.get(ErrorType.memberIdInconsistent)),
      );
    });

    it('should get multiple care plans by memberId', async () => {
      const carePlanTypeId = await generateCarePlanType();
      const carePlanTypeInput = generateCarePlanTypeInput({ id: carePlanTypeId });
      const memberId = generateId();
      const barrierId = await generateBarrier(memberId);
      const params = generateCreateCarePlanParams({
        memberId,
        createdBy: generateId(),
        type: carePlanTypeInput,
        barrierId,
      });
      const { id } = await service.createCarePlan(params);
      const params2 = generateCreateCarePlanParams({
        memberId,
        createdBy: generateId(),
        type: carePlanTypeInput,
        barrierId,
      });
      const { id: id2 } = await service.createCarePlan(params2);

      const result = await service.getMemberCarePlans(memberId);
      delete params.type;
      delete params2.type;
      expect(result).toEqual([
        expect.objectContaining({
          ...params,
          memberId: new Types.ObjectId(params.memberId),
          barrierId: new Types.ObjectId(params.barrierId),
          createdBy: new Types.ObjectId(params.createdBy),
          type: expect.objectContaining({ _id: new Types.ObjectId(carePlanTypeId) }),
          id,
        }),
        expect.objectContaining({
          ...params2,
          memberId: new Types.ObjectId(params2.memberId),
          barrierId: new Types.ObjectId(params2.barrierId),
          createdBy: new Types.ObjectId(params2.createdBy),
          type: expect.objectContaining({ _id: new Types.ObjectId(carePlanTypeId) }),
          id: id2,
        }),
      ]);
    });

    it('should update care plans and set completedAt', async () => {
      const memberId = generateId();
      const barrierId = await generateBarrier(memberId);
      const carePlanTypeId = await generateCarePlanType();
      const carePlanTypeInput = generateCarePlanTypeInput({ id: carePlanTypeId });
      const params = generateCreateCarePlanParams({
        memberId,
        createdBy: generateId(),
        type: carePlanTypeInput,
        barrierId,
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
        const memberId = generateId();
        const barrierId = await generateBarrier(memberId);
        const carePlanTypeId = await generateCarePlanType();
        const carePlanTypeInput = generateCarePlanTypeInput({ id: carePlanTypeId });
        const params = generateCreateCarePlanParams({
          memberId,
          createdBy: generateId(),
          type: carePlanTypeInput,
          barrierId,
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

    it('should get all carePlanTypes', async () => {
      const id1 = await generateCarePlanType();
      const carePlanType1 = await service.getCarePlanType(id1);
      const id2 = await generateCarePlanType();
      const carePlanType2 = await service.getCarePlanType(id2);

      const result = await service.getCarePlanTypes();
      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: carePlanType1.id,
            description: carePlanType1.description,
            createdBy: expect.any(Types.ObjectId),
            isCustom: false,
          }),
          expect.objectContaining({
            id: carePlanType2.id,
            description: carePlanType2.description,
            createdBy: expect.any(Types.ObjectId),
            isCustom: false,
          }),
        ]),
      );
    });

    it('should create and get carePlanType', async () => {
      const carePlanTypeName = lorem.words(5);
      const { id } = await service.createCarePlanType({
        description: carePlanTypeName,
        createdBy: generateId(),
        isCustom: true,
      });
      const result = await service.getCarePlanType(id);

      expect(result.id).toEqual(id.toString());
      expect(result.description).toEqual(carePlanTypeName);
    });
  });

  const generateCarePlanType = async (description = lorem.words(5)): Promise<string> => {
    const { id } = await service.createCarePlanType({
      description,
      createdBy: generateId(),
      isCustom: false,
    });
    return id;
  };

  const generateBarrierType = async (
    description = lorem.words(5),
    domain?: BarrierDomain,
    types?: string[],
  ): Promise<string> => {
    const carePlanTypes = types ? types : [await generateCarePlanType()];
    const barrierDomain = domain ? domain : (randomEnum(BarrierDomain) as BarrierDomain);
    const { id } = await barrierTypeModel.create({
      description,
      domain: barrierDomain,
      carePlanTypes,
    });
    return id;
  };

  const generateBarrier = async (memberId = generateId()): Promise<string> => {
    const redFlagId = await generateRedFlag(memberId);
    const type = await generateBarrierType();
    const params = generateCreateBarrierParams({
      createdBy: generateId(),
      memberId,
      redFlagId,
      type,
    });
    const { id } = await service.createBarrier(params);
    return id;
  };

  const generateRedFlag = async (memberId = generateId()): Promise<string> => {
    const params = generateCreateRedFlagParams({ createdBy: generateId(), memberId });
    const { id } = await service.createRedFlag(params);
    return id;
  };
});
