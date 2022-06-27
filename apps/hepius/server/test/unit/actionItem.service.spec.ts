import { generateId, mockLogger, mockProcessWarnings } from '@argus/pandora';
import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import {
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
} from '../../src/common';
import { JourneyService } from '../../src/journey';
import {
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

  beforeAll(async () => {
    mockProcessWarnings(); // to hide pino prettyPrint warning
    module = await Test.createTestingModule({
      imports: defaultModules().concat(ActionItemModule),
    }).compile();

    service = module.get<ActionItemService>(ActionItemService);
    journeyService = module.get<JourneyService>(JourneyService);
    mockLogger(module.get<LoggerService>(LoggerService));

    await dbConnect();
  });

  afterAll(async () => {
    await module.close();
    await dbDisconnect();
  });

  describe('createOrSetActionItem', () => {
    it('should create an action item', async () => {
      const memberId = generateId();
      const orgId = generateId();
      await journeyService.create({ memberId, orgId });
      const createActionItemParams = generateCreateOrSetActionItemParams({ memberId });
      const { id } = await service.createOrSetActionItem(createActionItemParams);

      expect(id).toEqual(expect.any(String));
    });

    it('should update an existing action item', async () => {
      const memberId = generateId();
      const orgId = generateId();
      await journeyService.create({ memberId, orgId });
      const createActionItemParams = generateCreateOrSetActionItemParams({ memberId });
      const { id } = await service.createOrSetActionItem(createActionItemParams);

      const updateParams = generateCreateOrSetActionItemParams({ id });
      await service.createOrSetActionItem(updateParams);
      const results = await service.getActionItems(memberId);
      delete updateParams.memberId;
      delete updateParams.appointmentId;

      expect(results).toEqual(
        expect.arrayContaining([expect.objectContaining({ ...updateParams })]),
      );
    });

    it('should override current params, even when undefined', async () => {
      const memberId = generateId();
      const orgId = generateId();
      await journeyService.create({ memberId, orgId });
      const createActionItemParams = generateCreateOrSetActionItemParams({ memberId });
      const { id } = await service.createOrSetActionItem(createActionItemParams);

      const updateParams = generateCreateOrSetActionItemParams({ id });
      delete updateParams.category;
      delete updateParams.description;
      delete updateParams.memberId;
      delete updateParams.appointmentId;
      await service.createOrSetActionItem(updateParams);
      const results = await service.getActionItems(memberId);
      expect(results).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ ...updateParams, category: undefined, description: undefined }),
        ]),
      );
    });

    it('should not be able to set for a non existing action item', async () => {
      await expect(
        service.createOrSetActionItem(generateCreateOrSetActionItemParams({ id: generateId() })),
      ).rejects.toThrow(Errors.get(ErrorType.journeyActionItemIdNotFound));
    });

    it('should not be able to create action item for a non existing member', async () => {
      await expect(
        service.createOrSetActionItem(generateCreateOrSetActionItemParams()),
      ).rejects.toThrow(Errors.get(ErrorType.memberNotFound));
    });
  });

  describe('getActionItems', () => {
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
      createActionItemParams1.appointmentId = generateId();
      createActionItemParams2.appointmentId = generateId();

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

    it(`should override action item with new params`, async () => {
      const memberId = generateId();
      const orgId = generateId();
      await journeyService.create({ memberId, orgId });
      // create
      const createActionItemParams1 = generateCreateOrSetActionItemParams({ memberId });
      createActionItemParams1.appointmentId = generateId();
      const { id } = await service.createOrSetActionItem(createActionItemParams1);

      const resultsBefore = await service.getActionItems(memberId);
      expect(resultsBefore).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            ...createActionItemParams1,
            id,
            memberId: new Types.ObjectId(memberId),
            appointmentId: new Types.ObjectId(createActionItemParams1.appointmentId),
          }),
        ]),
      );

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
            appointmentId: new Types.ObjectId(createActionItemParams1.appointmentId),
            description: undefined,
            rejectNote: undefined,
            category: undefined,
            deadline: undefined,
          }),
        ]),
      );
    });

    it('should return empty array on non existing action items per member', async () => {
      const memberId = generateId();
      const orgId = generateId();
      await journeyService.create({ memberId, orgId });
      const results = await service.getActionItems(memberId);
      expect(results.length).toEqual(0);
    });
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

    it('should return empty array on non existing action items per member', async () => {
      const memberId = generateId();
      const orgId = generateId();
      await journeyService.create({ memberId, orgId });
      const results = await service.getActionItems(memberId);
      expect(results.length).toEqual(0);
    });
  });
});
