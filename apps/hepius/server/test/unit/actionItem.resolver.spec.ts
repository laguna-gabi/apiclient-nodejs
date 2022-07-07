import { generateId, mockLogger, mockProcessWarnings } from '@argus/pandora';
import { Test, TestingModule } from '@nestjs/testing';
import { ActionItemModule, ActionItemResolver, ActionItemService } from '../../src/actionItem';
import { LoggerService } from '../../src/common';
import { dbDisconnect, defaultModules } from '../common';
import { generateCreateOrSetActionItemParams, mockGenerateActionItem } from '../generators';

describe(ActionItemResolver.name, () => {
  let module: TestingModule;
  let resolver: ActionItemResolver;
  let service: ActionItemService;

  beforeAll(async () => {
    mockProcessWarnings(); // to hide pino prettyPrint warning
    module = await Test.createTestingModule({
      imports: defaultModules().concat(ActionItemModule),
    }).compile();

    resolver = module.get<ActionItemResolver>(ActionItemResolver);
    service = module.get<ActionItemService>(ActionItemService);
    mockLogger(module.get<LoggerService>(LoggerService));
  });

  afterAll(async () => {
    await module.close();
    await dbDisconnect();
  });

  describe('createOrSetActionItem', () => {
    let spyOnServiceCreateOrSetActionItem;

    beforeEach(() => {
      spyOnServiceCreateOrSetActionItem = jest.spyOn(service, 'createOrSetActionItem');
    });

    afterEach(() => {
      spyOnServiceCreateOrSetActionItem.mockReset();
    });

    it('should set an action item', async () => {
      const actionItems = mockGenerateActionItem();
      spyOnServiceCreateOrSetActionItem.mockImplementationOnce(async () => actionItems);

      const createOrSetActionItem = generateCreateOrSetActionItemParams();
      const result = await resolver.createOrSetActionItem(createOrSetActionItem);

      expect(spyOnServiceCreateOrSetActionItem).toBeCalledTimes(1);
      expect(spyOnServiceCreateOrSetActionItem).toBeCalledWith(createOrSetActionItem);
      expect(result).toEqual(actionItems);
    });
  });

  describe('getActionItems', () => {
    let spyOnServiceGetActionItems;

    beforeEach(() => {
      spyOnServiceGetActionItems = jest.spyOn(service, 'getActionItems');
    });

    afterEach(() => {
      spyOnServiceGetActionItems.mockReset();
    });

    it('should get action Items by memberId', async () => {
      const actionItems = mockGenerateActionItem();
      spyOnServiceGetActionItems.mockImplementationOnce(async () => actionItems);

      const memberId = generateId();
      const result = await resolver.getActionItems(memberId);

      expect(spyOnServiceGetActionItems).toBeCalledTimes(1);
      expect(spyOnServiceGetActionItems).toBeCalledWith(memberId);
      expect(result).toEqual(actionItems);
    });
  });

  describe('deleteActionItem', () => {
    let spyOnServiceDelete;
    beforeEach(() => {
      spyOnServiceDelete = jest.spyOn(service, 'delete');
    });

    afterEach(() => {
      spyOnServiceDelete.mockReset();
    });

    it('should successfully delete an action item', async () => {
      spyOnServiceDelete.mockImplementationOnce(async () => true);

      const userId = generateId();
      const id = generateId();
      const result = await resolver.deleteActionItem(userId, id);
      expect(result).toBeTruthy();

      expect(spyOnServiceDelete).toBeCalledTimes(1);
      expect(spyOnServiceDelete).toBeCalledWith(id, userId);
    });
  });
});
