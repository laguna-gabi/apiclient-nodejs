import { MemberRole, UserRole } from '@argus/hepiusClient';
import { generateId, mockProcessWarnings } from '@argus/pandora';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import {
  ErrorType,
  Errors,
  EventType,
  IEventUpdateHealthPersona,
  IEventUpdateRelatedEntity,
} from '../../src/common';
import {
  CreateQuestionnaireParams,
  HealthPersona,
  QuestionnaireModule,
  QuestionnaireResolver,
  QuestionnaireService,
  QuestionnaireType,
} from '../../src/questionnaire';
import {
  dbDisconnect,
  defaultModules,
  generateCreateQuestionnaireParams,
  generateRelatedEntity,
  generateSubmitQuestionnaireResponseParams,
  mockGenerateJourney,
  mockGenerateQuestionnaire,
} from '../../test';
import { JourneyService, RelatedEntityType } from '../../src/journey';

describe('QuestionnaireResolver', () => {
  let module: TestingModule;
  let resolver: QuestionnaireResolver;
  let service: QuestionnaireService;
  let journeyService: JourneyService;
  let eventEmitter: EventEmitter2;

  beforeAll(async () => {
    mockProcessWarnings(); // to hide pino prettyPrint warning
    module = await Test.createTestingModule({
      imports: defaultModules().concat(QuestionnaireModule),
    }).compile();

    resolver = module.get<QuestionnaireResolver>(QuestionnaireResolver);
    service = module.get<QuestionnaireService>(QuestionnaireService);
    journeyService = module.get<JourneyService>(JourneyService);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
  });

  afterAll(async () => {
    await module.close();
    await dbDisconnect();
  });

  describe('createQuestionnaire', () => {
    let spyOnServiceCreate: jest.SpyInstance;

    beforeEach(() => {
      spyOnServiceCreate = jest.spyOn(service, 'createQuestionnaire');
      spyOnServiceCreate.mockImplementation(() => undefined);
    });

    afterEach(() => {
      spyOnServiceCreate.mockReset();
    });

    it('should create a Questionnaire (template)', async () => {
      const params: CreateQuestionnaireParams = generateCreateQuestionnaireParams();
      await resolver.createQuestionnaire(params);

      expect(spyOnServiceCreate).toHaveBeenCalledWith({ ...params });
    });
  });

  describe('getActiveQuestionnaires', () => {
    let spyOnServiceGet: jest.SpyInstance;

    beforeEach(() => {
      spyOnServiceGet = jest.spyOn(service, 'getActiveQuestionnaires');
      spyOnServiceGet.mockImplementation(() => undefined);
    });

    afterEach(() => {
      spyOnServiceGet.mockReset();
    });

    it('should get all active Questionnaires (templates)', async () => {
      await resolver.getActiveQuestionnaires();

      expect(spyOnServiceGet).toHaveBeenCalled();
    });
  });

  describe('getQuestionnaire', () => {
    let spyOnServiceGetById: jest.SpyInstance;

    beforeEach(() => {
      spyOnServiceGetById = jest.spyOn(service, 'getQuestionnaireById');
      spyOnServiceGetById.mockImplementation(() => undefined);
    });

    afterEach(() => {
      spyOnServiceGetById.mockReset();
    });

    it('should get a Questionnaire', async () => {
      const qId = generateId();
      await resolver.getQuestionnaire(UserRole.lagunaCoach, qId);

      expect(spyOnServiceGetById).toHaveBeenCalledWith(qId);
    });

    // eslint-disable-next-line max-len
    it('should fail to get Questionnaire by member since type not assignable to member', async () => {
      const questionnaire = mockGenerateQuestionnaire();
      questionnaire.isAssignableToMember = false;
      spyOnServiceGetById.mockImplementationOnce(() => questionnaire);

      await expect(resolver.getQuestionnaire(MemberRole.member, questionnaire.id)).rejects.toThrow(
        Errors.get(ErrorType.questionnaireNotAssignableToMember),
      );
    });
  });

  describe('getMemberQuestionnaireResponses', () => {
    let spyOnServiceGetQuestionnaireResponses: jest.SpyInstance;
    let spyOnServiceGetRecentJourney: jest.SpyInstance;

    beforeEach(() => {
      spyOnServiceGetQuestionnaireResponses = jest.spyOn(service, 'getQuestionnaireResponses');
      spyOnServiceGetRecentJourney = jest.spyOn(journeyService, 'getRecent');
      spyOnServiceGetQuestionnaireResponses.mockImplementation(() => undefined);
    });

    afterEach(() => {
      spyOnServiceGetQuestionnaireResponses.mockReset();
      spyOnServiceGetRecentJourney.mockReset();
    });

    it('should get all member Questionnaire Responses', async () => {
      const memberId = generateId();
      const mock = mockGenerateJourney({ memberId });
      spyOnServiceGetRecentJourney.mockResolvedValueOnce(mock);
      await resolver.getMemberQuestionnaireResponses(memberId);

      expect(spyOnServiceGetQuestionnaireResponses).toHaveBeenCalledWith({
        memberId,
        journeyId: mock.id,
      });
    });
  });

  describe('getQuestionnaireResponse', () => {
    let spyOnServiceGetQRById: jest.SpyInstance;

    beforeEach(() => {
      spyOnServiceGetQRById = jest.spyOn(service, 'getQuestionnaireResponseById');
      spyOnServiceGetQRById.mockImplementation(() => undefined);
    });

    afterEach(() => {
      spyOnServiceGetQRById.mockReset();
    });

    it('should get a Questionnaire Response', async () => {
      const qrId = generateId();
      await resolver.getQuestionnaireResponse(qrId);

      expect(spyOnServiceGetQRById).toHaveBeenCalledWith(qrId);
    });
  });

  describe('submitQuestionnaireResponse', () => {
    let spyOnServiceSubmitQR: jest.SpyInstance;
    let spyOnServiceGetHealthPersona: jest.SpyInstance;
    let spyOnServiceGetById: jest.SpyInstance;
    let spyOnServiceGetRecentJourney: jest.SpyInstance;

    beforeEach(() => {
      spyOnServiceSubmitQR = jest.spyOn(service, 'submitQuestionnaireResponse');
      spyOnServiceGetHealthPersona = jest.spyOn(service, 'getHealthPersona');
      spyOnServiceGetById = jest.spyOn(service, 'getQuestionnaireById');
      spyOnServiceGetRecentJourney = jest.spyOn(journeyService, 'getRecent');
    });

    afterEach(() => {
      spyOnServiceSubmitQR.mockReset();
      spyOnServiceGetHealthPersona.mockReset();
      spyOnServiceGetById.mockReset();
      spyOnServiceGetRecentJourney.mockReset();
    });

    it('should submit a Questionnaire Response', async () => {
      const qrSubmitParams = generateSubmitQuestionnaireResponseParams();
      spyOnServiceSubmitQR.mockResolvedValueOnce({ type: QuestionnaireType.phq9 });
      const mock = mockGenerateJourney({ memberId: qrSubmitParams.memberId });
      spyOnServiceGetRecentJourney.mockResolvedValueOnce(mock);
      await resolver.submitQuestionnaireResponse(UserRole.lagunaCoach, qrSubmitParams);

      expect(spyOnServiceSubmitQR).toHaveBeenCalledWith({ ...qrSubmitParams, journeyId: mock.id });
    });

    it('should emit onUpdateRelatedEntity when there is relatedEntity', async () => {
      const actionItemRelatedEntity = generateRelatedEntity({ type: RelatedEntityType.actionItem });
      const qrSubmitParams = generateSubmitQuestionnaireResponseParams({
        relatedEntity: actionItemRelatedEntity,
      });
      const qrId = generateId();
      spyOnServiceSubmitQR.mockResolvedValueOnce({ type: QuestionnaireType.phq9, id: qrId });
      const mock = mockGenerateJourney({ memberId: qrSubmitParams.memberId });
      spyOnServiceGetRecentJourney.mockResolvedValueOnce(mock);
      const spyOnEventEmitter = jest.spyOn(eventEmitter, 'emit');
      await resolver.submitQuestionnaireResponse(UserRole.lagunaCoach, qrSubmitParams);

      const event: IEventUpdateRelatedEntity = {
        destEntity: actionItemRelatedEntity,
        sourceEntity: { type: RelatedEntityType.questionnaireResponse, id: qrId },
      };
      expect(spyOnEventEmitter).toBeCalledWith(EventType.onUpdateRelatedEntity, event);
    });

    it(`should submit an ${QuestionnaireType.lhp} response and update health persona`, async () => {
      const healthPersona: HealthPersona = HealthPersona.active;
      const qrSubmitParams = generateSubmitQuestionnaireResponseParams();
      spyOnServiceGetRecentJourney.mockResolvedValueOnce(
        mockGenerateJourney({ memberId: qrSubmitParams.memberId }),
      );
      spyOnServiceGetHealthPersona.mockResolvedValueOnce(healthPersona);
      const spyOnEventEmitter = jest.spyOn(eventEmitter, 'emit');

      spyOnServiceSubmitQR.mockResolvedValueOnce({ type: QuestionnaireType.lhp });
      await resolver.submitQuestionnaireResponse(UserRole.lagunaCoach, qrSubmitParams);

      const event: IEventUpdateHealthPersona = { memberId: qrSubmitParams.memberId, healthPersona };
      expect(spyOnEventEmitter).toBeCalledWith(EventType.onUpdateHealthPersona, event);
    });

    // eslint-disable-next-line max-len
    it('should fail to submit a Questionnaire Response by member since type not assignable to member', async () => {
      const questionnaire = mockGenerateQuestionnaire();
      questionnaire.isAssignableToMember = false;
      spyOnServiceGetById.mockImplementationOnce(() => questionnaire);

      const qrSubmitParams = generateSubmitQuestionnaireResponseParams({
        questionnaireId: questionnaire.id,
      });

      await expect(
        resolver.submitQuestionnaireResponse(MemberRole.member, qrSubmitParams),
      ).rejects.toThrow(Errors.get(ErrorType.questionnaireNotAssignableToMember));
    });
  });
});
