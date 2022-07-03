import { generateId, mockLogger, mockProcessWarnings } from '@argus/pandora';
import { Test, TestingModule } from '@nestjs/testing';
import {
  dbDisconnect,
  defaultModules,
  generateCreateBarrierParams,
  generateCreateBarrierParamsWizard,
  generateCreateCarePlanParams,
  generateCreateCarePlanParamsWizard,
  generateCreateRedFlagParamsWizard,
  generateDeleteCarePlanParams,
  generateSubmitCareWizardParams,
  generateUpdateBarrierParams,
  generateUpdateCarePlanParams,
  generateUpdateRedFlagParams,
} from '..';
import { CareModule, CareResolver, CareService } from '../../src/care';
import { LoggerService } from '../../src/common';
import { JourneyService } from '../../src/journey';

describe('CareResolver', () => {
  let module: TestingModule;
  let service: CareService;
  let resolver: CareResolver;
  let journeyService: JourneyService;

  beforeAll(async () => {
    mockProcessWarnings(); // to hide pino prettyPrint warning
    module = await Test.createTestingModule({
      imports: defaultModules().concat(CareModule),
    }).compile();

    resolver = module.get<CareResolver>(CareResolver);
    service = module.get<CareService>(CareService);
    journeyService = module.get<JourneyService>(JourneyService);
    mockLogger(module.get<LoggerService>(LoggerService));
  });

  afterAll(async () => {
    await module.close();
    await dbDisconnect();
  });

  describe('RedFlag', () => {
    let spyOnServiceGetMemberRedFlags;
    let spyOnServiceUpdateRedFlag;
    let spyOnServiceGetRedFlagTypes;
    let spyOnJourneyServiceGetRecent;

    beforeEach(() => {
      spyOnServiceGetMemberRedFlags = jest.spyOn(service, 'getMemberRedFlags');
      spyOnServiceUpdateRedFlag = jest.spyOn(service, 'updateRedFlag');
      spyOnServiceGetRedFlagTypes = jest.spyOn(service, 'getRedFlagTypes');
      spyOnJourneyServiceGetRecent = jest.spyOn(journeyService, 'getRecent');
      spyOnServiceUpdateRedFlag.mockImplementationOnce(async () => undefined);
    });

    afterEach(() => {
      spyOnServiceGetMemberRedFlags.mockReset();
      spyOnServiceUpdateRedFlag.mockReset();
      spyOnServiceGetRedFlagTypes.mockReset();
      spyOnJourneyServiceGetRecent.mockReset();
    });

    it('should get red flags by memberId', async () => {
      const memberId = generateId();
      const journeyId = generateId();
      spyOnJourneyServiceGetRecent.mockReturnValueOnce({ id: journeyId });
      await resolver.getMemberRedFlags(memberId);

      expect(spyOnServiceGetMemberRedFlags).toBeCalledTimes(1);
      expect(spyOnServiceGetMemberRedFlags).toBeCalledWith({ memberId, journeyId });
    });

    it('should update a red flag', async () => {
      const params = generateUpdateRedFlagParams();
      await resolver.updateRedFlag(params);

      expect(spyOnServiceUpdateRedFlag).toBeCalledTimes(1);
      expect(spyOnServiceUpdateRedFlag).toBeCalledWith(params);
    });

    it('should get all redFlagTypes', async () => {
      await resolver.getRedFlagTypes();
      expect(spyOnServiceGetRedFlagTypes).toBeCalled();
    });
  });

  describe('Barrier', () => {
    let spyOnServiceGetMemberBarriers;
    let spyOnServiceUpdateBarrier;
    let spyOnServiceGetBarrierTypes;
    let spyOnServiceGetBarrierType;
    let spyOnServiceCreateBarrier;
    let spyOnJourneyServiceGetRecent;

    beforeEach(() => {
      spyOnServiceGetMemberBarriers = jest.spyOn(service, 'getMemberBarriers');
      spyOnServiceUpdateBarrier = jest.spyOn(service, 'updateBarrier');
      spyOnServiceCreateBarrier = jest.spyOn(service, 'createBarrier');
      spyOnServiceGetBarrierTypes = jest.spyOn(service, 'getBarrierTypes');
      spyOnServiceGetBarrierType = jest.spyOn(service, 'getBarrierType');
      spyOnJourneyServiceGetRecent = jest.spyOn(journeyService, 'getRecent');
    });

    afterEach(() => {
      spyOnServiceGetMemberBarriers.mockReset();
      spyOnServiceUpdateBarrier.mockReset();
      spyOnServiceCreateBarrier.mockReset();
      spyOnServiceGetBarrierTypes.mockReset();
      spyOnServiceGetBarrierType.mockReset();
      spyOnJourneyServiceGetRecent.mockReset();
    });

    it('should create a barrier', async () => {
      const params = generateCreateBarrierParams({ type: generateId() });
      const journeyId = generateId();
      spyOnJourneyServiceGetRecent.mockReturnValueOnce({ id: journeyId });
      spyOnServiceCreateBarrier.mockReturnValueOnce({ id: generateId(), ...params });
      spyOnServiceGetBarrierType.mockReturnValueOnce({ type: generateId() });
      await resolver.createBarrier(generateId(), params);

      expect(spyOnServiceCreateBarrier).toBeCalledTimes(1);
      expect(spyOnServiceCreateBarrier).toBeCalledWith({ ...params, journeyId });
    });

    it('should get barriers by memberId', async () => {
      const memberId = generateId();
      const journeyId = generateId();
      spyOnJourneyServiceGetRecent.mockReturnValueOnce({ id: journeyId });
      await resolver.getMemberBarriers(memberId);

      expect(spyOnServiceGetMemberBarriers).toBeCalledTimes(1);
      expect(spyOnServiceGetMemberBarriers).toBeCalledWith({ memberId, journeyId });
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
    let spyOnServiceDeleteCarePlan;
    let spyOnJourneyServiceGetRecent;

    beforeEach(() => {
      spyOnServiceCreateCarePlan = jest.spyOn(service, 'createCarePlan');
      spyOnServiceGetMemberCarePlans = jest.spyOn(service, 'getMemberCarePlans');
      spyOnServiceUpdateCarePlan = jest.spyOn(service, 'updateCarePlan');
      spyOnServiceGetCarePlanTypes = jest.spyOn(service, 'getCarePlanTypes');
      spyOnServiceDeleteCarePlan = jest.spyOn(service, 'deleteCarePlan');
      spyOnJourneyServiceGetRecent = jest.spyOn(journeyService, 'getRecent');
      spyOnServiceCreateCarePlan.mockImplementationOnce(async () => undefined);
      spyOnServiceUpdateCarePlan.mockImplementationOnce(async () => true);
      spyOnServiceDeleteCarePlan.mockImplementationOnce(async () => true);
    });

    afterEach(() => {
      spyOnServiceCreateCarePlan.mockReset();
      spyOnServiceGetMemberCarePlans.mockReset();
      spyOnServiceUpdateCarePlan.mockReset();
      spyOnServiceGetCarePlanTypes.mockReset();
      spyOnServiceDeleteCarePlan.mockReset();
      spyOnJourneyServiceGetRecent.mockReset();
    });

    it('should create a care plan', async () => {
      const params = generateCreateCarePlanParams();
      const journeyId = generateId();
      spyOnJourneyServiceGetRecent.mockReturnValueOnce({ id: journeyId });
      await resolver.createCarePlan(params);

      expect(spyOnServiceCreateCarePlan).toBeCalledTimes(1);
      expect(spyOnServiceCreateCarePlan).toBeCalledWith({ ...params, journeyId });
    });

    it('should get care plans by memberId', async () => {
      const memberId = generateId();
      const journeyId = generateId();
      spyOnJourneyServiceGetRecent.mockReturnValueOnce({ id: journeyId });
      await resolver.getMemberCarePlans(memberId);

      expect(spyOnServiceGetMemberCarePlans).toBeCalledTimes(1);
      expect(spyOnServiceGetMemberCarePlans).toBeCalledWith({ memberId, journeyId });
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

    it('should successfully delete a care plan', async () => {
      spyOnServiceDeleteCarePlan.mockImplementationOnce(async () => true);

      const userId = generateId();
      const id = generateId();
      const deleteCarePlanParams = generateDeleteCarePlanParams({ id });

      const result = await resolver.deleteCarePlan(userId, deleteCarePlanParams);
      expect(result).toBeTruthy();

      expect(spyOnServiceDeleteCarePlan).toBeCalledTimes(1);
      expect(spyOnServiceDeleteCarePlan).toBeCalledWith(deleteCarePlanParams, userId);
    });
  });

  describe('submitCareWizard', () => {
    let spyOnServiceCreateCarePlan;
    let spyOnServiceCreateBarrier;
    let spyOnServiceCreateRedFlag;
    let spyOnJourneyServiceGetRecent;
    let spyOnServiceGetBarrierType;

    beforeEach(() => {
      spyOnServiceCreateCarePlan = jest.spyOn(service, 'createCarePlan');
      spyOnServiceCreateRedFlag = jest.spyOn(service, 'createRedFlag');
      spyOnServiceCreateBarrier = jest.spyOn(service, 'createBarrier');
      spyOnJourneyServiceGetRecent = jest.spyOn(journeyService, 'getRecent');
      spyOnServiceGetBarrierType = jest.spyOn(service, 'getBarrierType');
      spyOnServiceCreateRedFlag.mockImplementation(async () => {
        return { id: generateId() };
      });
      spyOnServiceCreateCarePlan.mockImplementation(async () => {
        return { id: generateId() };
      });
    });

    afterEach(() => {
      spyOnServiceCreateCarePlan.mockReset();
      spyOnServiceCreateBarrier.mockReset();
      spyOnServiceCreateRedFlag.mockReset();
      spyOnJourneyServiceGetRecent.mockReset();
    });

    it('should get create all relevant entities from the wizard result', async () => {
      // setup wizard result
      const memberId = generateId();
      const journeyId = generateId();
      const carePlan1 = generateCreateCarePlanParamsWizard();
      const carePlan2 = generateCreateCarePlanParamsWizard();
      const carePlan3 = generateCreateCarePlanParamsWizard();
      const barrier1 = generateCreateBarrierParamsWizard({
        carePlans: [carePlan1, carePlan2],
      });
      const barrier2 = generateCreateBarrierParamsWizard({ carePlans: [carePlan3] });
      const redFlag = generateCreateRedFlagParamsWizard({
        barriers: [barrier1, barrier2],
      });
      spyOnJourneyServiceGetRecent.mockReturnValueOnce({ id: journeyId });
      const wizardParams = generateSubmitCareWizardParams({ redFlag, memberId });

      const type = generateId();
      spyOnServiceCreateBarrier.mockReturnValue({
        id: generateId(),
        ...generateCreateBarrierParams({ type }),
      });
      spyOnServiceGetBarrierType.mockReturnValue({ type });

      const result = await resolver.submitCareWizard(wizardParams);
      expect(result.ids.length).toEqual(3);

      // test red flags
      delete redFlag.barriers;
      expect(spyOnServiceCreateRedFlag).toHaveBeenCalledTimes(1);
      expect(spyOnServiceCreateRedFlag).toBeCalledWith({ ...redFlag, memberId, journeyId });

      // test barriers
      expect(spyOnServiceCreateBarrier).toHaveBeenCalledTimes(2);
      for (const barrier of [barrier1, barrier2]) {
        delete barrier.carePlans;
        expect(spyOnServiceCreateBarrier).toHaveBeenCalledWith({
          ...barrier,
          memberId,
          journeyId,
          redFlagId: expect.any(String),
        });
      }
      spyOnServiceGetBarrierType.mockReturnValue({ type: generateId() });

      // test care plans
      expect(spyOnServiceCreateCarePlan).toHaveBeenCalledTimes(3);
      for (const carePlan of [carePlan1, carePlan2, carePlan3]) {
        expect(spyOnServiceCreateCarePlan).toHaveBeenCalledWith({
          ...carePlan,
          memberId,
          journeyId,
          barrierId: expect.any(String),
        });
      }
    });
  });
});
