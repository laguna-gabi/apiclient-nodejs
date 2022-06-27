import {
  ChangeEventType,
  EntityName,
  createChangeEvent,
  generateId,
  mockLogger,
  mockProcessWarnings,
  randomEnum,
} from '@argus/pandora';
import { Test, TestingModule } from '@nestjs/testing';
import { lorem } from 'faker';
import { Model, Types, model } from 'mongoose';
import {
  checkDelete,
  confirmEmittedChangeEvent,
  dbConnect,
  dbDisconnect,
  defaultModules,
  generateCarePlanTypeInput,
  generateCreateBarrierParams,
  generateCreateCarePlanParams,
  generateCreateRedFlagParams,
  generateDeleteCarePlanParams,
  generateUpdateBarrierParams,
  generateUpdateCarePlanParams,
  generateUpdateRedFlagParams,
  loadSessionClient,
} from '..';
import {
  BarrierDocument,
  CareModule,
  CarePlanDocument,
  CareService,
  RedFlag,
  RedFlagDocument,
  RedFlagDto,
} from '../../src/care';
import { ErrorType, Errors, LoggerService } from '../../src/common';
import {
  Barrier,
  BarrierDomain,
  BarrierStatus,
  CarePlan,
  CarePlanStatus,
} from '@argus/hepiusClient';
import { EventEmitter2 } from '@nestjs/event-emitter';

describe('CareService', () => {
  let module: TestingModule;
  let service: CareService;
  let redFlagModel: Model<RedFlagDocument>;
  let barrierModel: Model<BarrierDocument>;
  let carePlanModel: Model<CarePlanDocument>;
  let mockEventEmitterEmit: jest.SpyInstance;

  afterEach(() => {
    mockEventEmitterEmit.mockReset();
  });

  beforeAll(async () => {
    mockProcessWarnings(); // to hide pino prettyPrint warning
    module = await Test.createTestingModule({
      imports: defaultModules().concat(CareModule),
    }).compile();

    service = module.get<CareService>(CareService);
    mockLogger(module.get<LoggerService>(LoggerService));
    mockEventEmitterEmit = jest.spyOn(module.get<EventEmitter2>(EventEmitter2), `emit`);
    redFlagModel = model<RedFlagDocument>(RedFlag.name, RedFlagDto);
    barrierModel = model<BarrierDocument>(Barrier.name, RedFlagDto);
    carePlanModel = model<CarePlanDocument>(CarePlan.name, RedFlagDto);
    await dbConnect();
  });

  afterAll(async () => {
    await module.close();
    await dbDisconnect();
  });

  describe('RedFlag', () => {
    it('should create a red flag', async () => {
      const type = await generateRedFlagType();
      const params = generateCreateRedFlagParams({ type });
      const { id } = await service.createRedFlag(params);

      const result = await service.getRedFlag(id);
      expect(result).toEqual(
        expect.objectContaining({
          ...params,
          memberId: new Types.ObjectId(params.memberId),
          type: new Types.ObjectId(type),
        }),
      );
    });

    it('should get multiple red flags by memberId', async () => {
      const memberId = generateId();
      const journeyId = generateId();
      const type = await generateRedFlagType();
      const params = generateCreateRedFlagParams({ memberId, type });
      const { id } = await service.createRedFlag(params);
      const params2 = generateCreateRedFlagParams({ memberId, type });
      const { id: id2 } = await service.createRedFlag(params2);

      const result = await service.getMemberRedFlags({ memberId, journeyId });
      expect(result).toEqual([
        expect.objectContaining({
          ...params,
          memberId: new Types.ObjectId(memberId),
          type: expect.objectContaining({ id: type }),
          id,
        }),
        expect.objectContaining({
          ...params2,
          memberId: new Types.ObjectId(memberId),
          type: expect.objectContaining({ id: type }),
          id: id2,
        }),
      ]);
    });

    it('should return empty list when there are no red flags for member', async () => {
      const result = await service.getMemberRedFlags({
        memberId: generateId(),
        journeyId: generateId(),
      });
      expect(result).toEqual([]);
    });

    it('should update a red flag', async () => {
      const type = await generateRedFlagType();
      const memberId = generateId();
      const params = generateCreateRedFlagParams({ memberId, type });
      const { id } = await service.createRedFlag(params);

      const updateParams = generateUpdateRedFlagParams({ id });
      const result = await service.updateRedFlag(updateParams);
      expect(result.notes).toEqual(updateParams.notes);
    });

    it('should get all barrierTypes', async () => {
      const desc = lorem.words(4);
      const desc2 = lorem.words(4);
      const id = await generateRedFlagType(desc);
      const id2 = await generateRedFlagType(desc2);
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const redFlagType = await service.getRedFlagType(id);
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const redFlagType2 = await service.getRedFlagType(id2);

      const result = await service.getRedFlagTypes();
      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: redFlagType.id,
            description: redFlagType.description,
          }),
          expect.objectContaining({
            id: redFlagType2.id,
            description: redFlagType2.description,
          }),
        ]),
      );
    });

    it('should create and get redFlagType', async () => {
      const description = lorem.words(4);
      // start a session and set userId id as client in store
      const userId = generateId();
      loadSessionClient(userId);

      const { id } = await service.createRedFlagType(description);
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const result = await service.getRedFlagType(id);

      expect(result).toEqual(
        expect.objectContaining({
          id,
          description: description,
          createdBy: new Types.ObjectId(userId),
          updatedBy: new Types.ObjectId(userId),
        }),
      );
    });
  });

  describe('Barrier', () => {
    test.each([true, false])(
      'should create a barrier with and without red flag: %p',
      async (withRedFlag) => {
        const memberId = generateId();
        const journeyId = generateId();
        const redFlagId = await generateRedFlag({ memberId, journeyId });
        const type = await generateBarrierType();
        const params = generateCreateBarrierParams({
          memberId,
          redFlagId: withRedFlag ? redFlagId : undefined,
          type: type,
        });
        const { id } = await service.createBarrier({ ...params, journeyId });

        const result = await service.getBarrier(id);
        expect(result).toEqual(
          expect.objectContaining({
            ...params,
            status: BarrierStatus.active,
            memberId: new Types.ObjectId(memberId),
            redFlagId: withRedFlag ? new Types.ObjectId(redFlagId) : undefined,
            type: new Types.ObjectId(type),
          }),
        );

        confirmEmittedChangeEvent(
          mockEventEmitterEmit,
          createChangeEvent({
            action: ChangeEventType.updated,
            entity: EntityName.barrier,
            memberId,
          }),
        );
      },
    );

    it('should fail to create a barrier with a wrong barrier type', async () => {
      const memberId = generateId();
      const journeyId = generateId();
      const redFlagId = await generateRedFlag({ memberId, journeyId });
      const params = generateCreateBarrierParams({
        memberId,
        redFlagId,
        type: generateId(),
      });
      await expect(service.createBarrier({ ...params, journeyId })).rejects.toThrow(
        Error(Errors.get(ErrorType.barrierTypeNotFound)),
      );
    });

    it('should fail to create a barrier with a wrong redFlagId', async () => {
      const memberId = generateId();
      const journeyId = generateId();
      const type = await generateBarrierType();
      const params = generateCreateBarrierParams({
        memberId,
        redFlagId: generateId(),
        type: type,
      });
      await expect(service.createBarrier({ ...params, journeyId })).rejects.toThrow(
        Error(Errors.get(ErrorType.redFlagNotFound)),
      );
    });

    it('should fail to create a barrier with an inconsistent memberId', async () => {
      const redFlagId = await generateRedFlag();
      const type = await generateBarrierType();
      const params = generateCreateBarrierParams({
        memberId: generateId(),
        redFlagId,
        type: type,
      });
      await expect(service.createBarrier({ ...params, journeyId: generateId() })).rejects.toThrow(
        Error(Errors.get(ErrorType.memberIdInconsistent)),
      );
    });

    it('should get multiple barriers by memberId', async () => {
      const memberId = generateId();
      const journeyId = generateId();
      const redFlagId = await generateRedFlag({ memberId, journeyId });
      const type = await generateBarrierType();
      const params = generateCreateBarrierParams({
        memberId,
        redFlagId,
        type,
      });
      const { id } = await service.createBarrier({ ...params, journeyId });
      const params2 = generateCreateBarrierParams({
        memberId,
        redFlagId,
        type,
      });
      const { id: id2 } = await service.createBarrier({ ...params2, journeyId });

      const result = await service.getMemberBarriers({ memberId, journeyId });
      expect(result).toEqual([
        expect.objectContaining({
          ...params,
          status: BarrierStatus.active,
          memberId: new Types.ObjectId(memberId),
          redFlagId: new Types.ObjectId(redFlagId),
          type: expect.objectContaining({ id: type }),
          id,
        }),
        expect.objectContaining({
          ...params2,
          status: BarrierStatus.active,
          memberId: new Types.ObjectId(memberId),
          redFlagId: new Types.ObjectId(redFlagId),
          type: expect.objectContaining({ id: type }),
          id: id2,
        }),
      ]);
    });

    it('should update barriers and set completedAt', async () => {
      const memberId = generateId();
      const journeyId = generateId();
      const redFlagId = await generateRedFlag({ memberId, journeyId });
      const type = await generateBarrierType();
      const params = generateCreateBarrierParams({
        memberId,
        redFlagId,
        type,
      });
      const { id } = await service.createBarrier({ ...params, journeyId });
      const barrierBefore = await service.getBarrier(id);
      expect(barrierBefore.completedAt).toBeUndefined();

      const updateParams = generateUpdateBarrierParams({ id });

      const result = await service.updateBarrier(updateParams);
      expect(result.status).toEqual(updateParams.status);
      expect(result.notes).toEqual(updateParams.notes);
      expect(result.type.toString()).toEqual(params.type);
      expect(result.completedAt).toEqual(expect.any(Date));
    });

    test.each(['notes', 'status'])(
      'should not override optional field %p when not set from params',
      async (param) => {
        const memberId = generateId();
        const journeyId = generateId();
        const redFlagId = await generateRedFlag({ memberId, journeyId });
        const type = await generateBarrierType();
        const params = generateCreateBarrierParams({
          memberId,
          redFlagId,
          type,
        });
        const { id } = await service.createBarrier({ ...params, journeyId });
        const barrierBefore = await service.getBarrier(id);
        expect(barrierBefore.completedAt).toBeUndefined();

        const updateParams = generateUpdateBarrierParams({ id });
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
      const result = await service.getMemberBarriers({
        memberId: generateId(),
        journeyId: generateId(),
      });
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
            carePlanTypes: expect.arrayContaining([expect.objectContaining({ id: carePlanType })]),
          }),
          expect.objectContaining({
            id: barrierType2.id,
            description: barrierType2.description,
            domain: BarrierDomain.logistical,
            carePlanTypes: expect.arrayContaining([expect.objectContaining({ id: carePlanType2 })]),
          }),
        ]),
      );
    });

    it('should create and get barrierType', async () => {
      const carePlanType = await generateCarePlanType();
      const description = lorem.words(4);
      // start a session and set userId id as client in store
      const userId = generateId();
      loadSessionClient(userId);

      const { id } = await service.createBarrierType({
        description,
        domain: BarrierDomain.medical,
        carePlanTypes: [carePlanType],
      });
      const result = await service.getBarrierType(id);

      expect(result).toEqual(
        expect.objectContaining({
          id,
          description: description,
          domain: BarrierDomain.medical,
          carePlanTypes: expect.arrayContaining([expect.objectContaining({ id: carePlanType })]),
          createdBy: new Types.ObjectId(userId),
          updatedBy: new Types.ObjectId(userId),
        }),
      );
    });
  });

  describe('CarePlan', () => {
    describe('create', () => {
      it('should create a custom care plan', async () => {
        const memberId = generateId();
        const journeyId = generateId();
        const barrierId = await generateBarrier({ memberId, journeyId });
        const custom = lorem.words(4);
        const carePlanTypeInput = generateCarePlanTypeInput({ custom });
        const params = generateCreateCarePlanParams({
          type: carePlanTypeInput,
          barrierId,
          memberId,
        });
        const { id } = await service.createCarePlan({ ...params, journeyId });

        const result = await service.getCarePlan(id);
        const carePlanType = await service.getCarePlanType(result.type.toString());
        expect(carePlanType).toEqual(
          expect.objectContaining({
            description: custom,
            isCustom: true,
          }),
        );

        delete params.type;
        expect(result).toEqual(
          expect.objectContaining({
            ...params,
            status: CarePlanStatus.active,
            memberId: new Types.ObjectId(params.memberId),
            barrierId: new Types.ObjectId(params.barrierId),
          }),
        );
      });

      it('should create a care plan with a specific type', async () => {
        const memberId = generateId();
        const journeyId = generateId();
        const barrierId = await generateBarrier({ memberId, journeyId });
        const carePlanTypeId = await generateCarePlanType();
        const carePlanTypeInput = generateCarePlanTypeInput({ id: carePlanTypeId });
        const params = generateCreateCarePlanParams({
          type: carePlanTypeInput,
          barrierId,
          memberId,
        });
        const { id } = await service.createCarePlan({ ...params, journeyId });
        const result = await service.getCarePlan(id);

        delete params.type;
        expect(result).toEqual(
          expect.objectContaining({
            ...params,
            status: CarePlanStatus.active,
            memberId: new Types.ObjectId(params.memberId),

            barrierId: new Types.ObjectId(params.barrierId),
            type: new Types.ObjectId(carePlanTypeId),
          }),
        );
      });

      it('should fail to create a care plan with a wrong care plan type', async () => {
        const memberId = generateId();
        const journeyId = generateId();
        const barrierId = await generateBarrier({ memberId, journeyId });

        const params = generateCreateCarePlanParams({
          barrierId,
          memberId,
          type: generateCarePlanTypeInput({ id: generateId() }),
        });

        await expect(service.createCarePlan({ ...params, journeyId })).rejects.toThrow(
          Error(Errors.get(ErrorType.carePlanTypeNotFound)),
        );
      });

      it('should fail to create a care plan with a wrong barrierId', async () => {
        const carePlanTypeId = await generateCarePlanType();
        const carePlanTypeInput = generateCarePlanTypeInput({ id: carePlanTypeId });
        const params = generateCreateCarePlanParams({
          barrierId: generateId(),
          type: carePlanTypeInput,
        });

        await expect(
          service.createCarePlan({ ...params, journeyId: generateId() }),
        ).rejects.toThrow(Error(Errors.get(ErrorType.barrierNotFound)));
      });

      it('should fail to create a care plan with an inconsistent memberId', async () => {
        const barrierId = await generateBarrier();
        const carePlanTypeId = await generateCarePlanType();
        const carePlanTypeInput = generateCarePlanTypeInput({ id: carePlanTypeId });
        const params = generateCreateCarePlanParams({
          barrierId,
          type: carePlanTypeInput,
        });

        await expect(
          service.createCarePlan({ ...params, journeyId: generateId() }),
        ).rejects.toThrow(Error(Errors.get(ErrorType.memberIdInconsistent)));
      });
    });

    describe('get', () => {
      it('should get multiple care plans by memberId', async () => {
        const carePlanTypeId = await generateCarePlanType();
        const carePlanTypeInput = generateCarePlanTypeInput({ id: carePlanTypeId });
        const memberId = generateId();
        const journeyId = generateId();
        const barrierId = await generateBarrier({ memberId, journeyId });
        const params = generateCreateCarePlanParams({
          memberId,
          type: carePlanTypeInput,
          barrierId,
        });
        const { id } = await service.createCarePlan({ ...params, journeyId });
        const params2 = generateCreateCarePlanParams({
          memberId,
          type: carePlanTypeInput,
          barrierId,
        });
        const { id: id2 } = await service.createCarePlan({ ...params2, journeyId });

        const result = await service.getMemberCarePlans({ memberId, journeyId });
        delete params.type;
        delete params2.type;
        expect(result).toEqual([
          expect.objectContaining({
            ...params,
            memberId: new Types.ObjectId(params.memberId),
            barrierId: new Types.ObjectId(params.barrierId),
            type: expect.objectContaining({ id: carePlanTypeId }),
            id,
          }),
          expect.objectContaining({
            ...params2,
            memberId: new Types.ObjectId(params2.memberId),
            barrierId: new Types.ObjectId(params2.barrierId),
            type: expect.objectContaining({ id: carePlanTypeId }),
            id: id2,
          }),
        ]);
      });

      it('should return empty list when there are no care plans for member', async () => {
        const result = await service.getMemberCarePlans({
          memberId: generateId(),
          journeyId: generateId(),
        });
        expect(result).toEqual([]);
      });
    });

    describe('update', () => {
      it('should update care plans and set completedAt', async () => {
        const memberId = generateId();
        const journeyId = generateId();
        const barrierId = await generateBarrier({ memberId, journeyId });
        const carePlanTypeId = await generateCarePlanType();
        const carePlanTypeInput = generateCarePlanTypeInput({ id: carePlanTypeId });
        const params = generateCreateCarePlanParams({
          memberId,
          type: carePlanTypeInput,
          barrierId,
        });
        const { id } = await service.createCarePlan({ ...params, journeyId });
        const carePlanBefore = await service.getCarePlan(id);
        expect(carePlanBefore.completedAt).toBeUndefined();

        const updateParams = generateUpdateCarePlanParams({ id });
        const result = await service.updateCarePlan(updateParams);
        expect(result).toEqual(
          expect.objectContaining({
            ...updateParams,
            completedAt: expect.any(Date),
          }),
        );
      });

      test.each(['notes', 'status'])(
        'should not override optional field %p when not set from params',
        async (param) => {
          const memberId = generateId();
          const journeyId = generateId();
          const barrierId = await generateBarrier({ memberId, journeyId });
          const carePlanTypeId = await generateCarePlanType();
          const carePlanTypeInput = generateCarePlanTypeInput({ id: carePlanTypeId });
          const params = generateCreateCarePlanParams({
            memberId,
            type: carePlanTypeInput,
            barrierId,
          });
          const { id } = await service.createCarePlan({ ...params, journeyId });
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
    });

    describe('delete', () => {
      it('should successfully delete a care plan', async () => {
        const memberId = generateId();
        const journeyId = generateId();
        const userId = generateId();
        const barrierId = await generateBarrier({ memberId, journeyId });
        const carePlanTypeId = await generateCarePlanType();
        const carePlanTypeInput = generateCarePlanTypeInput({ id: carePlanTypeId });
        const params = generateCreateCarePlanParams({
          memberId,
          type: carePlanTypeInput,
          barrierId,
        });
        const { id } = await service.createCarePlan({ ...params, journeyId });
        const carePlanBefore = await service.getCarePlan(id);
        expect(carePlanBefore).not.toBeNull();

        const deleteParams = generateDeleteCarePlanParams({ id });
        await service.deleteCarePlan(deleteParams, userId);
        /* eslint-disable @typescript-eslint/ban-ts-comment*/
        // @ts-ignore
        const carePlanAfter = await carePlanModel.findWithDeleted({
          _id: new Types.ObjectId(id),
        });
        checkDelete(carePlanAfter, { id }, userId);
      });

      it('should throw exception when trying to delete a non existing care plan', async () => {
        await expect(
          service.deleteCarePlan(generateDeleteCarePlanParams(), generateId()),
        ).rejects.toThrow(Errors.get(ErrorType.carePlanNotFound));
      });
    });

    describe('carePlanTypes', () => {
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
              isCustom: false,
            }),
            expect.objectContaining({
              id: carePlanType2.id,
              description: carePlanType2.description,
              isCustom: false,
            }),
          ]),
        );
      });

      it('should create and get carePlanType', async () => {
        const carePlanTypeName = lorem.words(5);
        const { id } = await service.createCarePlanType({
          description: carePlanTypeName,
          isCustom: true,
        });
        const result = await service.getCarePlanType(id);

        expect(result.id).toEqual(id.toString());
        expect(result.description).toEqual(carePlanTypeName);
      });
    });
  });

  describe(`Delete all member's data`, () => {
    test.each([true, false])(
      'should %p delete member care process (Red flags, barriers and care plans)',
      async (hard) => {
        const redFlagType = await generateRedFlagType();
        const memberId = generateId();
        const journeyId = generateId();
        const redFlagParams = generateCreateRedFlagParams({ memberId, type: redFlagType });
        const { id: redFlagId } = await service.createRedFlag(redFlagParams);
        const barrierType = await generateBarrierType();
        const params = generateCreateBarrierParams({
          memberId,
          redFlagId,
          type: barrierType,
        });
        const { id: barrierId } = await service.createBarrier({ ...params, journeyId });

        const carePlanTypeId = await generateCarePlanType();
        const carePlanTypeInput = generateCarePlanTypeInput({ id: carePlanTypeId });
        const carePlanParams = generateCreateCarePlanParams({
          type: carePlanTypeInput,
          barrierId,
          memberId,
        });
        const { id: carePlanId } = await service.createCarePlan({ ...carePlanParams, journeyId });
        const redFlag = await service.getRedFlag(redFlagId);
        const barrier = await service.getBarrier(barrierId);
        const carePlan = await service.getCarePlan(carePlanId);
        expect([redFlag, barrier, carePlan].filter((i) => i != null).length).toEqual(3);

        await service.deleteMemberCareProcess({ memberId, deletedBy: memberId, hard });
        /* eslint-disable @typescript-eslint/ban-ts-comment*/
        // @ts-ignore
        const redFlagAfter = await redFlagModel.findWithDeleted({
          _id: new Types.ObjectId(redFlagId),
        });
        // @ts-ignore
        const barrierAfter = await barrierModel.findWithDeleted({
          _id: new Types.ObjectId(barrierId),
        });
        // @ts-ignore
        const carePlanAfter = await carePlanModel.findWithDeleted({
          _id: new Types.ObjectId(carePlanId),
        });

        if (hard) {
          expect(
            [...redFlagAfter, ...barrierAfter, ...carePlanAfter].filter((i) => i != null).length,
          ).toEqual(0);
        } else {
          checkDelete(redFlagAfter, { _id: new Types.ObjectId(redFlagId) }, memberId);
          checkDelete(barrierAfter, { _id: new Types.ObjectId(barrierId) }, memberId);
          checkDelete(carePlanAfter, { _id: new Types.ObjectId(carePlanId) }, memberId);
        }
      },
    );

    /* eslint-disable max-len */
    it('should hard delete after soft delete - member care process (Red flags, barriers and care plans)', async () => {
      const redFlagType = await generateRedFlagType();
      const memberId = generateId();
      const journeyId = generateId();
      const redFlagParams = generateCreateRedFlagParams({ memberId, type: redFlagType });
      const { id: redFlagId } = await service.createRedFlag(redFlagParams);
      const barrierType = await generateBarrierType();
      const params = generateCreateBarrierParams({
        memberId,
        redFlagId,
        type: barrierType,
      });
      const { id: barrierId } = await service.createBarrier({ ...params, journeyId });

      const carePlanTypeId = await generateCarePlanType();
      const carePlanTypeInput = generateCarePlanTypeInput({ id: carePlanTypeId });
      const carePlanParams = generateCreateCarePlanParams({
        type: carePlanTypeInput,
        barrierId,
        memberId,
      });
      const { id: carePlanId } = await service.createCarePlan({ ...carePlanParams, journeyId });
      const redFlag = await service.getRedFlag(redFlagId);
      const barrier = await service.getBarrier(barrierId);
      const carePlan = await service.getCarePlan(carePlanId);
      expect([redFlag, barrier, carePlan].filter((i) => i != null).length).toEqual(3);

      await service.deleteMemberCareProcess({ memberId, deletedBy: memberId, hard: false });
      await service.deleteMemberCareProcess({ memberId, deletedBy: memberId, hard: true });

      /* eslint-disable @typescript-eslint/ban-ts-comment*/
      // @ts-ignore
      const redFlagAfter = await redFlagModel.findWithDeleted({
        _id: new Types.ObjectId(redFlagId),
      });
      // @ts-ignore
      const barrierAfter = await barrierModel.findWithDeleted({
        _id: new Types.ObjectId(barrierId),
      });
      // @ts-ignore
      const carePlanAfter = await carePlanModel.findWithDeleted({
        _id: new Types.ObjectId(carePlanId),
      });

      expect(
        [...redFlagAfter, ...barrierAfter, ...carePlanAfter].filter((i) => i != null).length,
      ).toEqual(0);
    });
  });

  const generateCarePlanType = async (description = lorem.words(5)): Promise<string> => {
    const { id } = await service.createCarePlanType({
      description,
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
    const { id } = await service.createBarrierType({
      description,
      domain: barrierDomain,
      carePlanTypes,
    });
    return id;
  };

  const generateBarrier = async ({
    memberId = generateId(),
    journeyId = generateId(),
  } = {}): Promise<string> => {
    const redFlagId = await generateRedFlag({ memberId, journeyId });
    const type = await generateBarrierType();
    const params = generateCreateBarrierParams({
      memberId,
      redFlagId,
      type,
    });
    const { id } = await service.createBarrier({ ...params, journeyId });
    return id;
  };

  const generateRedFlag = async ({
    memberId = generateId(),
    journeyId = generateId(),
  } = {}): Promise<string> => {
    const type = await generateRedFlagType();
    const params = generateCreateRedFlagParams({ memberId, type });
    const { id } = await service.createRedFlag({ ...params, journeyId });
    return id;
  };

  const generateRedFlagType = async (description = lorem.words(5)): Promise<string> => {
    const { id } = await service.createRedFlagType(description);
    return id;
  };
});
