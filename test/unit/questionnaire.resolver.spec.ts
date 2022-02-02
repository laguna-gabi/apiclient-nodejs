import { mockProcessWarnings } from '@lagunahealth/pandora';
import { Test, TestingModule } from '@nestjs/testing';
import { dbDisconnect, defaultModules, generateCreateQuestionnaireParams } from '../../test';
import {
  CreateQuestionnaireParams,
  QuestionnaireModule,
  QuestionnaireResolver,
  QuestionnaireService,
} from '../../src/questionnaire';

describe('QuestionnaireResolver', () => {
  let module: TestingModule;
  let resolver: QuestionnaireResolver;
  let service: QuestionnaireService;

  beforeAll(async () => {
    mockProcessWarnings(); // to hide pino prettyPrint warning
    module = await Test.createTestingModule({
      imports: defaultModules().concat(QuestionnaireModule),
    }).compile();

    resolver = module.get<QuestionnaireResolver>(QuestionnaireResolver);
    service = module.get<QuestionnaireService>(QuestionnaireService);
  });

  afterAll(async () => {
    await module.close();
    await dbDisconnect();
  });

  describe('createQuestionnaire', () => {
    let spyOnServiceCreate: jest.SpyInstance;

    beforeEach(() => {
      spyOnServiceCreate = jest.spyOn(service, 'create');
    });

    afterEach(() => {
      spyOnServiceCreate.mockReset();
    });

    it('should create a Questionnaire', async () => {
      const params: CreateQuestionnaireParams = generateCreateQuestionnaireParams();

      await resolver.createQuestionnaire(params);

      expect(spyOnServiceCreate).toHaveBeenCalledWith(params);
    });
  });

  describe('getQuestionnaires', () => {
    let spyOnServiceGet: jest.SpyInstance;

    beforeEach(() => {
      spyOnServiceGet = jest.spyOn(service, 'get');
    });

    afterEach(() => {
      spyOnServiceGet.mockReset();
    });

    it('should get a Questionnaire', async () => {
      await resolver.getQuestionnaires();

      expect(spyOnServiceGet).toHaveBeenCalled();
    });
  });
});
