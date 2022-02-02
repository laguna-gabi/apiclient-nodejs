import { mockProcessWarnings } from '@lagunahealth/pandora';
import { Test, TestingModule } from '@nestjs/testing';
import { Model, Types, model } from 'mongoose';
import {
  dbConnect,
  dbDisconnect,
  defaultModules,
  generateCreateQuestionnaireParams,
} from '../../test';
import {
  CreateQuestionnaireParams,
  Questionnaire,
  QuestionnaireDto,
  QuestionnaireModule,
  QuestionnaireService,
} from '../../src/questionnaire';
import * as faker from 'faker';

describe('QuestionnaireService', () => {
  let module: TestingModule;
  let service: QuestionnaireService;
  let questionnaireModel: Model<typeof QuestionnaireDto>;

  beforeAll(async () => {
    mockProcessWarnings(); // to hide pino prettyPrint warning
    module = await Test.createTestingModule({
      imports: defaultModules().concat(QuestionnaireModule),
    }).compile();

    service = module.get<QuestionnaireService>(QuestionnaireService);

    questionnaireModel = model(Questionnaire.name, QuestionnaireDto);

    await dbConnect();
  });

  afterAll(async () => {
    await module.close();
    await dbDisconnect();
  });

  beforeEach(async () => {
    await questionnaireModel.deleteMany();
  });

  describe('create', () => {
    it('should create a questionnaire', async () => {
      const params: CreateQuestionnaireParams = generateCreateQuestionnaireParams();

      const { id } = await service.create(params);
      expect(id).not.toBeUndefined();

      const createdQuestionnaire = await questionnaireModel.findById(id).lean();
      expect(createdQuestionnaire).toEqual({
        ...params,
        _id: new Types.ObjectId(id),
        active: true,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
    });
  });

  describe('get', () => {
    it('should get a single active questionnaire', async () => {
      const params: CreateQuestionnaireParams = generateCreateQuestionnaireParams();

      // create 2 questionnaires with the same type (only one - latest - is active)
      await service.create(params);
      // perform an update to questionnaire name..
      const updatedQuestionnaireName = faker.lorem.words(3);
      const { id } = await service.create({ ...params, name: updatedQuestionnaireName });

      const allQuestionnaires = await service.get();

      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      expect(allQuestionnaires[0].toObject()).toEqual({
        ...params,
        name: updatedQuestionnaireName,
        _id: new Types.ObjectId(id),
        active: true,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
    });
  });
});
