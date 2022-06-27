import { generateId, mockLogger, mockProcessWarnings } from '@argus/pandora';
import { Test, TestingModule } from '@nestjs/testing';
import {
  ActionItemCategory,
  ActionItemModule,
  ActionItemService,
  AutoActionItem,
  autoActionItemsOnFirstAppointment,
} from '../../src/actionItem';
import { LoggerService } from '../../src/common';
import { QuestionnaireService } from '../../src/questionnaire';
import { dbDisconnect, defaultModules } from '../common';
import { mockGenerateActionItem, mockGenerateQuestionnaire } from '../generators';

describe(AutoActionItem.name, () => {
  let module: TestingModule;
  let autoActionItem: AutoActionItem;
  let actionItemService: ActionItemService;
  let questionnaireService: QuestionnaireService;

  beforeAll(async () => {
    mockProcessWarnings(); // to hide pino prettyPrint warning
    module = await Test.createTestingModule({
      imports: defaultModules().concat(ActionItemModule),
    }).compile();

    autoActionItem = module.get<AutoActionItem>(AutoActionItem);
    actionItemService = module.get<ActionItemService>(ActionItemService);
    questionnaireService = module.get<QuestionnaireService>(QuestionnaireService);
    mockLogger(module.get<LoggerService>(LoggerService));
  });

  afterAll(async () => {
    await module.close();
    await dbDisconnect();
  });

  describe('handleFirstAppointment', () => {
    let spyOnServiceCreateOrSetActionItem;
    let spyOnQuestionnaireServiceGetByType;

    beforeEach(() => {
      spyOnServiceCreateOrSetActionItem = jest.spyOn(actionItemService, 'createOrSetActionItem');
      spyOnQuestionnaireServiceGetByType = jest.spyOn(
        questionnaireService,
        'getQuestionnaireByType',
      );
    });

    afterEach(() => {
      spyOnServiceCreateOrSetActionItem.mockReset();
      spyOnQuestionnaireServiceGetByType.mockReset();
    });

    it('should create action items on first appointment', async () => {
      const actionItems = mockGenerateActionItem();
      const memberId = generateId();
      const questionnaire = mockGenerateQuestionnaire();
      const appointmentId = generateId();
      spyOnServiceCreateOrSetActionItem.mockImplementationOnce(async () => actionItems);
      spyOnQuestionnaireServiceGetByType.mockImplementationOnce(async () => questionnaire);

      await autoActionItem.handleFirstAppointment({ memberId, appointmentId });

      for (let i = 1; i < autoActionItemsOnFirstAppointment.length; i++) {
        expect(spyOnServiceCreateOrSetActionItem).toHaveBeenNthCalledWith(
          i,
          expect.objectContaining({
            category: ActionItemCategory.jobAid,
            memberId,
            appointmentId,
          }),
        );
      }
    });
  });
});
