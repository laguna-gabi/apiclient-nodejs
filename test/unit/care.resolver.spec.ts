import { mockLogger, mockProcessWarnings } from '@lagunahealth/pandora';
import { Test, TestingModule } from '@nestjs/testing';
import { LoggerService } from '../../src/common';
import {
  dbDisconnect,
  defaultModules,
  generateCreateBarrierParamsWizard,
  generateCreateCarePlanParams,
  generateCreateCarePlanParamsWizard,
  generateCreateRedFlagParams,
  generateCreateRedFlagParamsWizard,
  generateId,
  generateSubmitCareWizardResult,
  generateUpdateBarrierParams,
  generateUpdateCarePlanParams,
  generateUpdateRedFlagParams,
} from '../index';
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
    let spyOnServiceUpdateRedFlag;

    beforeEach(() => {
      spyOnServiceCreateRedFlag = jest.spyOn(service, 'createRedFlag');
      spyOnServiceGetMemberRedFlags = jest.spyOn(service, 'getMemberRedFlags');
      spyOnServiceDeleteRedFlags = jest.spyOn(service, 'deleteRedFlag');
      spyOnServiceUpdateRedFlag = jest.spyOn(service, 'updateRedFlag');
      spyOnServiceCreateRedFlag.mockImplementationOnce(async () => undefined);
      spyOnServiceDeleteRedFlags.mockImplementationOnce(async () => true);
      spyOnServiceUpdateRedFlag.mockImplementationOnce(async () => undefined);
    });

    afterEach(() => {
      spyOnServiceCreateRedFlag.mockReset();
      spyOnServiceGetMemberRedFlags.mockReset();
      spyOnServiceDeleteRedFlags.mockReset();
      spyOnServiceUpdateRedFlag.mockReset();
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

    it('should update a red flag', async () => {
      const params = generateUpdateRedFlagParams();
      await resolver.updateRedFlag(params);

      expect(spyOnServiceUpdateRedFlag).toBeCalledTimes(1);
      expect(spyOnServiceUpdateRedFlag).toBeCalledWith(params);
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

  describe('Barrier', () => {
    let spyOnServiceGetMemberBarriers;
    let spyOnServiceUpdateBarrier;
    let spyOnServiceGetBarrierTypes;

    beforeEach(() => {
      spyOnServiceGetMemberBarriers = jest.spyOn(service, 'getMemberBarriers');
      spyOnServiceUpdateBarrier = jest.spyOn(service, 'updateBarrier');
      spyOnServiceGetBarrierTypes = jest.spyOn(service, 'getBarrierTypes');
      spyOnServiceUpdateBarrier.mockImplementationOnce(async () => true);
    });

    afterEach(() => {
      spyOnServiceGetMemberBarriers.mockReset();
      spyOnServiceUpdateBarrier.mockReset();
      spyOnServiceGetBarrierTypes.mockReset();
    });

    it('should get barriers by memberId', async () => {
      const memberId = generateId();
      await resolver.getMemberBarriers(memberId);

      expect(spyOnServiceGetMemberBarriers).toBeCalledTimes(1);
      expect(spyOnServiceGetMemberBarriers).toBeCalledWith(memberId);
    });

    it('should update a barrier', async () => {
      const params = generateUpdateBarrierParams();
      await resolver.updateBarrier(params);

      expect(spyOnServiceUpdateBarrier).toBeCalledTimes(1);
      expect(spyOnServiceUpdateBarrier).toBeCalledWith(params);
    });

    it('should get all barrierTypes', async () => {
      await resolver.getBarrierTypes();
      expect(spyOnServiceGetBarrierTypes).toBeCalled();
    });
  });

  describe('CarePlan', () => {
    let spyOnServiceCreateCarePlan;
    let spyOnServiceGetMemberCarePlans;
    let spyOnServiceUpdateCarePlan;
    let spyOnServiceGetCarePlanTypes;

    beforeEach(() => {
      spyOnServiceCreateCarePlan = jest.spyOn(service, 'createCarePlan');
      spyOnServiceGetMemberCarePlans = jest.spyOn(service, 'getMemberCarePlans');
      spyOnServiceUpdateCarePlan = jest.spyOn(service, 'updateCarePlan');
      spyOnServiceGetCarePlanTypes = jest.spyOn(service, 'getCarePlanTypes');
      spyOnServiceCreateCarePlan.mockImplementationOnce(async () => undefined);
      spyOnServiceUpdateCarePlan.mockImplementationOnce(async () => true);
    });

    afterEach(() => {
      spyOnServiceCreateCarePlan.mockReset();
      spyOnServiceGetMemberCarePlans.mockReset();
      spyOnServiceUpdateCarePlan.mockReset();
      spyOnServiceGetCarePlanTypes.mockReset();
    });

    it('should create a care plan', async () => {
      const params = generateCreateCarePlanParams();
      const userId = generateId();
      await resolver.createCarePlan(userId, params);

      expect(spyOnServiceCreateCarePlan).toBeCalledTimes(1);
      expect(spyOnServiceCreateCarePlan).toBeCalledWith({ ...params, createdBy: userId });
    });

    it('should get care plans by memberId', async () => {
      const memberId = generateId();
      await resolver.getMemberCarePlans(memberId);

      expect(spyOnServiceGetMemberCarePlans).toBeCalledTimes(1);
      expect(spyOnServiceGetMemberCarePlans).toBeCalledWith(memberId);
    });

    it('should update a care plan', async () => {
      const params = generateUpdateCarePlanParams();
      await resolver.updateCarePlan(params);

      expect(spyOnServiceUpdateCarePlan).toBeCalledTimes(1);
      expect(spyOnServiceUpdateCarePlan).toBeCalledWith(params);
    });

    it('should get all carePlanTypes', async () => {
      await resolver.getCarePlanTypes();
      expect(spyOnServiceGetCarePlanTypes).toBeCalled();
    });
  });

  describe('submitCareWizardResult', () => {
    let spyOnServiceCreateCarePlan;
    let spyOnServiceCreateBarrier;
    let spyOnServiceCreateRedFlag;

    beforeEach(() => {
      spyOnServiceCreateCarePlan = jest.spyOn(service, 'createCarePlan');
      spyOnServiceCreateRedFlag = jest.spyOn(service, 'createRedFlag');
      spyOnServiceCreateBarrier = jest.spyOn(service, 'createBarrier');
      spyOnServiceCreateRedFlag.mockImplementation(async () => {
        return { id: generateId() };
      });
      spyOnServiceCreateCarePlan.mockImplementation(async () => {
        return { id: generateId() };
      });
      spyOnServiceCreateBarrier.mockImplementation(async () => {
        return { id: generateId() };
      });
    });

    afterEach(() => {
      spyOnServiceCreateCarePlan.mockReset();
      spyOnServiceCreateBarrier.mockReset();
      spyOnServiceCreateRedFlag.mockReset();
    });

    it('should get create all relevant entities from the wizard result', async () => {
      // setup wizard result
      const memberId = generateId();
      const createdBy = generateId();
      const carePlan1 = generateCreateCarePlanParamsWizard({ createdBy });
      const carePlan2 = generateCreateCarePlanParamsWizard({ createdBy });
      const carePlan3 = generateCreateCarePlanParamsWizard({ createdBy });
      const barrier1 = generateCreateBarrierParamsWizard({
        carePlans: [carePlan1, carePlan2],
        createdBy,
      });
      const barrier2 = generateCreateBarrierParamsWizard({ carePlans: [carePlan3], createdBy });
      const redFlag = generateCreateRedFlagParamsWizard({
        barriers: [barrier1, barrier2],
        createdBy,
      });
      const wizardResult = generateSubmitCareWizardResult({ redFlag, memberId });

      const result = await resolver.submitCareWizardResult(createdBy, wizardResult);
      expect(result.ids.length).toEqual(3);

      // test red flags
      delete redFlag.barriers;
      expect(spyOnServiceCreateRedFlag).toHaveBeenCalledTimes(1);
      expect(spyOnServiceCreateRedFlag).toBeCalledWith({ ...redFlag, memberId, createdBy });

      // test barriers
      expect(spyOnServiceCreateBarrier).toHaveBeenCalledTimes(2);
      for (const barrier of [barrier1, barrier2]) {
        delete barrier.carePlans;
        expect(spyOnServiceCreateBarrier).toHaveBeenCalledWith({
          ...barrier,
          memberId,
          createdBy,
          redFlagId: expect.any(String),
        });
      }

      // test care plans
      expect(spyOnServiceCreateCarePlan).toHaveBeenCalledTimes(3);
      for (const carePlan of [carePlan1, carePlan2, carePlan3]) {
        expect(spyOnServiceCreateCarePlan).toHaveBeenCalledWith({
          ...carePlan,
          memberId,
          createdBy,
          barrierId: expect.any(String),
        });
      }
    });
  });
});
