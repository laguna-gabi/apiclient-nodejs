import { generateId, mockLogger, mockProcessWarnings } from '@argus/pandora';
import { Test, TestingModule } from '@nestjs/testing';
import { Model, Types, model } from 'mongoose';
import {
  ActionItem,
  ActionItemDocument,
  ActionItemDto,
  ActionItemModule,
  ActionItemPriority,
  ActionItemService,
  ActionItemStatus,
} from '../../src/actionItem';
import {
  ErrorType,
  Errors,
  IEventUpdateRelatedEntity,
  LoggerService,
  RelatedEntityType,
  defaultTimestampsDbValues,
} from '../../src/common';
import { JourneyService } from '../../src/journey';
import {
  checkDelete,
  dbConnect,
  dbDisconnect,
  defaultModules,
  generateCreateOrSetActionItemParams,
  generateRelatedEntity,
} from '../index';

describe(ActionItemService.name, () => {
  let module: TestingModule;
  let service: ActionItemService;
  let journeyService: JourneyService;
  let actionItemModel: Model<ActionItemDocument & defaultTimestampsDbValues>;

  beforeAll(async () => {
    mockProcessWarnings(); // to hide pino prettyPrint warning
    module = await Test.createTestingModule({
      imports: defaultModules().concat(ActionItemModule),
    }).compile();

    service = module.get<ActionItemService>(ActionItemService);
    journeyService = module.get<JourneyService>(JourneyService);
    actionItemModel = model<ActionItemDocument & defaultTimestampsDbValues>(
      ActionItem.name,
      ActionItemDto,
    );
    mockLogger(module.get<LoggerService>(LoggerService));

    await dbConnect();
  });

  afterAll(async () => {
    await module.close();
    await dbDisconnect();
  });

  describe('createOrSetActionItem + getActionItems', () => {
    it(`should create and get member's action items`, async () => {
      const memberId = generateId();
      const orgId = generateId();
      await journeyService.create({ memberId, orgId });
      const createActionItemParams1 = generateCreateOrSetActionItemParams({ memberId });
      const questionnaire = generateRelatedEntity({
        type: RelatedEntityType.questionnaire,
      });
      const createActionItemParams2 = generateCreateOrSetActionItemParams({
        memberId,
        priority: ActionItemPriority.urgent,
        relatedEntities: [questionnaire],
      });
      // test default properties
      delete createActionItemParams1.priority;
      delete createActionItemParams1.status;
      delete createActionItemParams1.relatedEntities;
      delete createActionItemParams1.title;

      const { id: id1 } = await service.createOrSetActionItem(createActionItemParams1);
      const { id: id2 } = await service.createOrSetActionItem(createActionItemParams2);

      delete createActionItemParams1.memberId;
      delete createActionItemParams2.memberId;
      const results = await service.getActionItems(memberId);
      expect(results.length).toEqual(2);
      expect(results).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            ...createActionItemParams1,
            id: id1,
            memberId: new Types.ObjectId(memberId),
            appointmentId: new Types.ObjectId(createActionItemParams1.appointmentId),
            // test default properties
            relatedEntities: [],
            status: ActionItemStatus.active,
            priority: ActionItemPriority.normal,
            title: '',
          }),
          expect.objectContaining({
            ...createActionItemParams2,
            id: id2,
            memberId: new Types.ObjectId(memberId),
            appointmentId: new Types.ObjectId(createActionItemParams2.appointmentId),
            relatedEntities: [questionnaire],
          }),
        ]),
      );
    });

    it(`should override action item with new params, even when undefined`, async () => {
      const memberId = generateId();
      const orgId = generateId();
      await journeyService.create({ memberId, orgId });
      // create
      const createActionItemParams1 = generateCreateOrSetActionItemParams({ memberId });
      const { id } = await service.createOrSetActionItem(createActionItemParams1);

      // set
      const createActionItemParams2 = generateCreateOrSetActionItemParams({
        id,
      });
      // test removing properties
      delete createActionItemParams2.description;
      delete createActionItemParams2.rejectNote;
      createActionItemParams2.category = undefined;
      createActionItemParams2.deadline = null;

      await service.createOrSetActionItem(createActionItemParams2);
      const resultsAfter = await service.getActionItems(memberId);

      expect(resultsAfter).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            ...createActionItemParams2,
            id,
            memberId: new Types.ObjectId(memberId),
            appointmentId: new Types.ObjectId(createActionItemParams2.appointmentId),
            description: undefined,
            rejectNote: undefined,
            category: undefined,
            deadline: undefined,
          }),
        ]),
      );
    });

    it('should not be able to set for a non existing action item', async () => {
      await expect(
        service.createOrSetActionItem(generateCreateOrSetActionItemParams({ id: generateId() })),
      ).rejects.toThrow(Errors.get(ErrorType.actionItemIdNotFound));
    });

    it('should not be able to create action item for a non existing member', async () => {
      await expect(
        service.createOrSetActionItem(generateCreateOrSetActionItemParams()),
      ).rejects.toThrow(Errors.get(ErrorType.memberNotFound));
    });
  });

  describe('delete', () => {
    it('should successfully delete an action item', async () => {
      const memberId = generateId();
      const orgId = generateId();
      await journeyService.create({ memberId, orgId });
      const params = generateCreateOrSetActionItemParams({ memberId });
      const userId = generateId();

      const { id } = await service.createOrSetActionItem(params);

      let result = await actionItemModel.findById(id);
      expect(result).not.toBeNull();

      await service.delete(id, userId);

      result = await actionItemModel.findById(id);
      expect(result).toBeNull();

      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const deletedResult = await actionItemModel.findWithDeleted({
        _id: new Types.ObjectId(id),
      });
      checkDelete(deletedResult, { _id: new Types.ObjectId(id) }, userId);
    });

    it('should throw exception when trying to delete a non existing action item', async () => {
      await expect(service.delete(generateId(), generateId())).rejects.toThrow(
        Errors.get(ErrorType.actionItemIdNotFound),
      );
    });
  });

  it('should return empty array on non existing action items per member', async () => {
    const memberId = generateId();
    const orgId = generateId();
    await journeyService.create({ memberId, orgId });
    const results = await service.getActionItems(memberId);
    expect(results.length).toEqual(0);
  });

  describe('handleUpdateRelatedEntityActionItem', () => {
    it('should update related entity in action items', async () => {
      const memberId = generateId();
      const orgId = generateId();
      await journeyService.create({ memberId, orgId });
      const questionnaire = generateRelatedEntity({
        type: RelatedEntityType.questionnaire,
      });
      const createActionItemParams = generateCreateOrSetActionItemParams({
        memberId,
        relatedEntities: [questionnaire],
      });
      createActionItemParams.appointmentId = generateId();
      const { id } = await service.createOrSetActionItem(createActionItemParams);

      const questionnaireResponse = {
        type: RelatedEntityType.questionnaireResponse,
        id: generateId(),
      };
      const eventParams: IEventUpdateRelatedEntity = {
        destEntity: { type: RelatedEntityType.actionItem, id },
        sourceEntity: questionnaireResponse,
      };

      await service.handleUpdateRelatedEntityActionItem(eventParams);

      const results = await service.getActionItems(memberId);
      expect(results).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            ...createActionItemParams,
            memberId: new Types.ObjectId(memberId),
            appointmentId: new Types.ObjectId(createActionItemParams.appointmentId),
            relatedEntities: [questionnaire, questionnaireResponse],
            status: ActionItemStatus.completed,
            id,
          }),
        ]),
      );
    });
  });
});
