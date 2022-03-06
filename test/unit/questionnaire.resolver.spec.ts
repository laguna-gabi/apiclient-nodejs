import { mockProcessWarnings } from '@lagunahealth/pandora';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { EventType, IEventUpdateHealthPersona } from '../../src/common';
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
  generateId,
  generateSubmitQuestionnaireResponseParams,
} from '../../test';

describe('QuestionnaireResolver', () => {
  let module: TestingModule;
  let resolver: QuestionnaireResolver;
  let service: QuestionnaireService;
  let eventEmitter: EventEmitter2;

  beforeAll(async () => {
    mockProcessWarnings(); // to hide pino prettyPrint warning
    module = await Test.createTestingModule({
      imports: defaultModules().concat(QuestionnaireModule),
    }).compile();

    resolver = module.get<QuestionnaireResolver>(QuestionnaireResolver);
    service = module.get<QuestionnaireService>(QuestionnaireService);
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
      await resolver.getQuestionnaire(qId);

      expect(spyOnServiceGetById).toHaveBeenCalledWith(qId);
    });
  });

  describe('getMemberQuestionnaireResponses', () => {
    let spyOnServiceGetByMemberId: jest.SpyInstance;

    beforeEach(() => {
      spyOnServiceGetByMemberId = jest.spyOn(service, 'getQuestionnaireResponseByMemberId');
      spyOnServiceGetByMemberId.mockImplementation(() => undefined);
    });

    afterEach(() => {
      spyOnServiceGetByMemberId.mockReset();
    });

    it('should get all member Questionnaire Responses', async () => {
      const mId = generateId();
      await resolver.getMemberQuestionnaireResponses(mId);

      expect(spyOnServiceGetByMemberId).toHaveBeenCalledWith(mId);
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

    beforeEach(() => {
      spyOnServiceSubmitQR = jest.spyOn(service, 'submitQuestionnaireResponse');
      spyOnServiceGetHealthPersona = jest.spyOn(service, 'getHealthPersona');
    });

    afterEach(() => {
      spyOnServiceSubmitQR.mockReset();
      spyOnServiceGetHealthPersona.mockReset();
    });

    it('should submit a Questionnaire Response', async () => {
      const qrSubmitParams = generateSubmitQuestionnaireResponseParams();
      spyOnServiceSubmitQR.mockResolvedValueOnce({ type: QuestionnaireType.phq9 });
      await resolver.submitQuestionnaireResponse(qrSubmitParams);

      expect(spyOnServiceSubmitQR).toHaveBeenCalledWith({ ...qrSubmitParams });
    });

    it(`should submit an ${QuestionnaireType.lhp} response and update health persona`, async () => {
      const healthPersona: HealthPersona = HealthPersona.active;
      spyOnServiceGetHealthPersona.mockResolvedValueOnce(healthPersona);
      const spyOnEventEmitter = jest.spyOn(eventEmitter, 'emit');

      const qrSubmitParams = generateSubmitQuestionnaireResponseParams();
      spyOnServiceSubmitQR.mockResolvedValueOnce({ type: QuestionnaireType.lhp });
      await resolver.submitQuestionnaireResponse(qrSubmitParams);

      const event: IEventUpdateHealthPersona = { memberId: qrSubmitParams.memberId, healthPersona };
      expect(spyOnEventEmitter).toBeCalledWith(EventType.onUpdateHealthPersona, event);
    });
  });
});
