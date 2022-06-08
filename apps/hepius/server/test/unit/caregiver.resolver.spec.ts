import { generateId, mockLogger, mockProcessWarnings } from '@argus/pandora';
import { Test, TestingModule } from '@nestjs/testing';
import {
  dbDisconnect,
  defaultModules,
  generateAddCaregiverParams,
  generateUpdateCaregiverParams,
} from '..';
import { LoggerService } from '../../src/common';
import { MemberModule } from '../../src/member';
import { CaregiverResolver, CaregiverService, JourneyService } from '../../src/journey';

describe(CaregiverResolver.name, () => {
  let module: TestingModule;
  let resolver: CaregiverResolver;
  let service: CaregiverService;
  let journeyService: JourneyService;
  let spyOnAddCaregiverServiceMethod;
  let spyOnUpdateCaregiverServiceMethod;
  let spyOnGetCaregiversServiceMethod;
  let spyOnDeleteCaregiverServiceMethod;
  let spyOnGetCaregiverServiceMethod;
  let spyOnGetRecentJourney;

  beforeAll(async () => {
    mockProcessWarnings(); // to hide pino prettyPrint warning
    module = await Test.createTestingModule({
      imports: defaultModules().concat(MemberModule),
    }).compile();

    resolver = module.get<CaregiverResolver>(CaregiverResolver);
    service = module.get<CaregiverService>(CaregiverService);
    journeyService = module.get<JourneyService>(JourneyService);
    mockLogger(module.get<LoggerService>(LoggerService));
  });

  afterAll(async () => {
    await module.close();
    await dbDisconnect();
  });

  beforeEach(() => {
    spyOnAddCaregiverServiceMethod = jest.spyOn(service, 'addCaregiver');
    spyOnUpdateCaregiverServiceMethod = jest.spyOn(service, 'updateCaregiver');
    spyOnGetCaregiversServiceMethod = jest.spyOn(service, 'getCaregivers');
    spyOnDeleteCaregiverServiceMethod = jest.spyOn(service, 'deleteCaregiver');
    spyOnGetCaregiverServiceMethod = jest.spyOn(service, 'getCaregiver');
    spyOnGetRecentJourney = jest.spyOn(journeyService, 'getRecent');
  });

  afterEach(() => {
    spyOnAddCaregiverServiceMethod.mockReset();
    spyOnUpdateCaregiverServiceMethod.mockReset();
    spyOnGetCaregiversServiceMethod.mockReset();
    spyOnDeleteCaregiverServiceMethod.mockReset();
    spyOnGetCaregiverServiceMethod.mockReset();
    spyOnGetRecentJourney.mockReset();
  });

  it('should add a caregiver', async () => {
    const memberId = generateId();
    const journeyId = generateId();
    spyOnGetRecentJourney.mockReturnValueOnce({ id: journeyId });

    const addCaregiverParams = generateAddCaregiverParams({ memberId });
    await resolver.addCaregiver(addCaregiverParams);
    expect(spyOnAddCaregiverServiceMethod).toBeCalledTimes(1);
    expect(spyOnAddCaregiverServiceMethod).toBeCalledWith({ ...addCaregiverParams, journeyId });
  });

  it('should update a caregiver with the inferred memberId', async () => {
    const memberId = generateId();
    const journeyId = generateId();
    spyOnGetRecentJourney.mockReturnValueOnce({ id: journeyId });

    const updateCaregiverParams = generateUpdateCaregiverParams({ memberId });
    await resolver.updateCaregiver(updateCaregiverParams);
    expect(spyOnUpdateCaregiverServiceMethod).toBeCalledTimes(1);
    expect(spyOnUpdateCaregiverServiceMethod).toBeCalledWith({
      ...updateCaregiverParams,
      journeyId,
    });
  });

  it('should get all caregiver for a member', async () => {
    const memberId = generateId();
    const journeyId = generateId();
    spyOnGetRecentJourney.mockReturnValueOnce({ id: journeyId });

    await resolver.getCaregivers(memberId);
    expect(spyOnGetCaregiversServiceMethod).toBeCalledTimes(1);
    expect(spyOnGetCaregiversServiceMethod).toBeCalledWith({ memberId, journeyId });
  });

  it('should delete a caregiver', async () => {
    const caregiverId = generateId();
    const memberId = generateId();

    spyOnGetCaregiverServiceMethod.mockImplementationOnce(async () => {
      return { memberId };
    });
    await resolver.deleteCaregiver(caregiverId, memberId.toString());

    expect(spyOnDeleteCaregiverServiceMethod).toBeCalledTimes(1);
    expect(spyOnDeleteCaregiverServiceMethod).toBeCalledWith(caregiverId, memberId.toString());
  });
});
