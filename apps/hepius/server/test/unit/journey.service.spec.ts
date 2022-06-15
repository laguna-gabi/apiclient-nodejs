import { generateId, mockLogger, mockProcessWarnings } from '@argus/pandora';
import { Test, TestingModule } from '@nestjs/testing';
import { ErrorType, Errors, IEventUpdateRelatedEntity, LoggerService } from '../../src/common';
import {
  ActionItemPriority,
  ActionItemStatus,
  AudioFormat,
  ImageFormat,
  Journal,
  JournalDocument,
  JournalDto,
  JourneyModule,
  JourneyService,
  ReadmissionRisk,
  RelatedEntityType,
  UpdateJourneyParams,
} from '../../src/journey';
import {
  dbConnect,
  dbDisconnect,
  defaultModules,
  generateCreateOrSetActionItemParams,
  generateGetMemberUploadJournalImageLinkParams,
  generateOrgParams,
  generateRelatedEntity,
  generateReplaceMemberOrgParams,
  generateSetGeneralNotesParams,
  generateUpdateJournalTextParams,
  generateUpdateJourneyParams,
} from '../index';
import { Model, Types, model } from 'mongoose';
import { lorem } from 'faker';
import { OrgService } from '../../src/org';

describe(JourneyService.name, () => {
  let module: TestingModule;
  let service: JourneyService;
  let orgService: OrgService;
  let modelJournal: Model<JournalDocument>;

  beforeAll(async () => {
    mockProcessWarnings(); // to hide pino prettyPrint warning
    module = await Test.createTestingModule({
      imports: defaultModules().concat(JourneyModule),
    }).compile();

    service = module.get<JourneyService>(JourneyService);
    orgService = module.get<OrgService>(OrgService);
    modelJournal = model<JournalDocument>(Journal.name, JournalDto);
    mockLogger(module.get<LoggerService>(LoggerService));

    await dbConnect();
  });

  afterAll(async () => {
    await module.close();
    await dbDisconnect();
  });

  it('should create multiple journeys and return them', async () => {
    const memberId = generateId();
    const orgId = generateId();

    const { id: id1 } = await service.create({ memberId, orgId });
    const { id: id2 } = await service.create({ memberId, orgId });

    expect(id1).not.toEqual(id2);

    const matchObject = { memberId: new Types.ObjectId(memberId), admissions: [] };
    const result = await service.get(id2);
    expect(result).toMatchObject({ id: id2, ...matchObject });

    const results = await service.getAll({ memberId });
    expect(results).toMatchObject([
      { id: id2, ...matchObject },
      { id: id1, ...matchObject },
    ]);

    const recentJourney = await service.getRecent(memberId);
    expect(recentJourney).toMatchObject({ id: id2, ...matchObject });
  });

  it('should throw exception on journey not found', async () => {
    await expect(service.get(generateId())).rejects.toThrow(Errors.get(ErrorType.journeyNotFound));
  });

  it('should return empty journey list', async () => {
    const result = await service.getAll({ memberId: generateId() });
    expect(result).toHaveLength(0);
  });

  it('should throw member not found', async () => {
    await expect(service.getRecent(generateId())).rejects.toThrow(
      Errors.get(ErrorType.memberNotFound),
    );
  });

  describe('replaceMemberOrg', () => {
    it('should update member org', async () => {
      const memberId = generateId();

      const { id: oldOrgId } = await orgService.insert(generateOrgParams());
      const { id: newOrgId } = await orgService.insert(generateOrgParams());

      await service.create({ memberId, orgId: oldOrgId });
      await service.replaceMemberOrg({ memberId, orgId: newOrgId });

      const { org } = await service.getRecent(memberId, true);
      expect(org.id.toString()).toEqual(newOrgId);
    });

    it('should fail to replace member org if member does not exist', async () => {
      await expect(service.replaceMemberOrg(generateReplaceMemberOrgParams())).rejects.toThrow(
        Errors.get(ErrorType.memberNotFound),
      );
    });
  });

  describe('ControlJourney', () => {
    it('should create and get recent control journey', async () => {
      const memberId = generateId();
      const orgId = generateId();

      const { id } = await service.createControl({ memberId, orgId });

      const matchObject = { memberId: new Types.ObjectId(memberId), admissions: [] };
      const recentJourney = await service.getRecentControl(memberId);
      expect(recentJourney).toMatchObject({ id, ...matchObject });
    });
  });

  describe('updateMemberConfigLoggedInAt', () => {
    it('should update member config login time and not update firstLogin on 2nd time', async () => {
      const memberId = generateId();
      const orgId = generateId();
      await service.create({ memberId, orgId });

      const currentTime1 = new Date().getTime();
      await service.updateLoggedInAt(new Types.ObjectId(memberId));

      const journey1 = await service.getRecent(memberId);
      expect(journey1.firstLoggedInAt.getTime()).toBeGreaterThanOrEqual(currentTime1);
      expect(journey1.lastLoggedInAt.getTime()).toBeGreaterThanOrEqual(currentTime1);

      const currentTime2 = new Date().getTime();
      await service.updateLoggedInAt(new Types.ObjectId(memberId));

      const journey2 = await service.getRecent(memberId);
      expect(journey2.firstLoggedInAt.getTime()).toEqual(journey1.firstLoggedInAt.getTime());
      expect(journey2.lastLoggedInAt.getTime()).toBeGreaterThanOrEqual(currentTime2);
    });
  });

  test.each([true, false])('should delete member journeys (hard=%p)', async (hard) => {
    const memberId = generateId();
    const orgId = generateId();
    const memberIdTestGroup = generateId();
    const { id: journeyId1 } = await service.create({ memberId, orgId });
    const { id: journeyId2 } = await service.create({ memberId, orgId });
    const { id: journeyIdMemberTestGroup } = await service.create({
      memberId: memberIdTestGroup,
      orgId,
    });

    const journeysBefore = await service.getAll({ memberId });
    expect(journeysBefore.length).toEqual(2);

    await service.deleteJourney({ memberId, deletedBy: memberId, hard });

    const journeysAfter = await service.getAll({ memberId });
    expect(journeysAfter.length).toEqual(0);
    await expect(service.get(journeyId1)).rejects.toThrow(Errors.get(ErrorType.journeyNotFound));
    await expect(service.get(journeyId2)).rejects.toThrow(Errors.get(ErrorType.journeyNotFound));

    const journeysMemberTestGroup = await service.getAll({ memberId: memberIdTestGroup });
    expect(journeysMemberTestGroup.length).toEqual(1);
    const existingJourney = await service.get(journeyIdMemberTestGroup);
    expect(existingJourney).not.toBeNull();
  });

  describe('update', () => {
    it('should throw error when memberId does not exist', async () => {
      await expect(
        service.update(generateUpdateJourneyParams({ memberId: generateId() })),
      ).rejects.toThrow(Errors.get(ErrorType.memberNotFound));
    });

    it('should return existing journey when no update params provided(without id)', async () => {
      const memberId = generateId();
      const orgId = generateId();
      const { id } = await service.create({ memberId, orgId });

      const { id: updateResultId } = await service.update(
        generateUpdateJourneyParams({ memberId }),
      );
      expect(id.toString()).toEqual(updateResultId);
    });

    it('should return existing journey when no update params provided(with id)', async () => {
      const memberId = generateId();
      const orgId = generateId();
      await service.create({ memberId, orgId });
      await checkUpdate({ memberId });
    });

    it('should multiple update item', async () => {
      const memberId = generateId();
      const orgId = generateId();
      await service.create({ memberId, orgId });

      await checkUpdate(generateUpdateJourneyParams({ memberId }));
      await checkUpdate(generateUpdateJourneyParams({ memberId }));
    });

    it('should be able to update partial fields', async () => {
      const memberId = generateId();
      const orgId = generateId();
      await service.create({ memberId, orgId });

      const updateParams1 = generateUpdateJourneyParams({ memberId });
      await checkUpdate(updateParams1);

      const updateParams2 = generateUpdateJourneyParams({ memberId });
      delete updateParams2.fellowName;
      await checkUpdate(updateParams2);

      const current = await service.getRecent(memberId);
      expect(current).toEqual(
        expect.objectContaining({
          ...updateParams2,
          fellowName: updateParams1.fellowName,
          memberId: new Types.ObjectId(memberId),
        }),
      );
    });

    it('should not add to readmissionRiskHistory if the readmissionRisk is the same', async () => {
      const memberId = generateId();
      const orgId = generateId();
      await service.create({ memberId, orgId });

      const updateJourney = generateUpdateJourneyParams({
        memberId,
        readmissionRisk: ReadmissionRisk.low,
      });

      const updateJourneyResult1 = await service.update(updateJourney);
      expect(updateJourneyResult1.readmissionRiskHistory.length).toEqual(1);

      const updateJourneyResult2 = await service.update(updateJourney);
      expect(updateJourneyResult2.readmissionRiskHistory.length).toEqual(1);
      expect(updateJourneyResult2.readmissionRiskHistory).toEqual(
        expect.arrayContaining([{ readmissionRisk: ReadmissionRisk.low, date: expect.any(Date) }]),
      );
    });

    it('should add to readmissionRiskHistory if the readmissionRisk is not the same', async () => {
      const memberId = generateId();
      const orgId = generateId();
      await service.create({ memberId, orgId });

      const updateJourney1 = generateUpdateJourneyParams({
        memberId,
        readmissionRisk: ReadmissionRisk.low,
      });

      const updateJourneyResult1 = await service.update(updateJourney1);
      expect(updateJourneyResult1.readmissionRiskHistory.length).toEqual(1);

      const updateJourney2 = generateUpdateJourneyParams({
        memberId,
        readmissionRisk: ReadmissionRisk.medium,
      });

      const updateJourneyResult2 = await service.update(updateJourney2);
      expect(updateJourneyResult2.readmissionRiskHistory.length).toEqual(2);
      expect(updateJourneyResult2.readmissionRiskHistory).toEqual(
        expect.arrayContaining([
          { readmissionRisk: ReadmissionRisk.low, date: expect.any(Date) },
          { readmissionRisk: ReadmissionRisk.medium, date: expect.any(Date) },
        ]),
      );
    });

    const checkUpdate = async (updateParams: UpdateJourneyParams) => {
      const result = await service.update(updateParams);
      expect(result).toEqual(
        expect.objectContaining({
          ...updateParams,
          memberId: new Types.ObjectId(updateParams.memberId),
        }),
      );
    };

    describe('graduate', () => {
      it('should set graduate on existing member', async () => {
        const currentTime = new Date();
        const memberId = generateId();
        const orgId = generateId();
        const { id } = await service.create({ memberId, orgId });
        await service.graduate({ id: memberId, isGraduated: true });

        const result1 = await service.get(id);
        expect(result1.isGraduated).toBeTruthy();
        expect(result1.graduationDate.getTime()).toBeGreaterThanOrEqual(currentTime.getTime());

        await service.graduate({ id: memberId, isGraduated: false });

        const result2 = await service.get(id);
        expect(result2.isGraduated).toBeFalsy();
        expect(result2.graduationDate).toBeFalsy();
      });
    });
  });

  describe('setGeneralNotes', () => {
    it('should set general notes and nurse notes for a member', async () => {
      const memberId = generateId();
      const orgId = generateId();
      await service.create({ memberId, orgId });

      const generalNotes = generateSetGeneralNotesParams({ memberId });
      await service.setGeneralNotes(generalNotes);

      const result = await service.getRecent(memberId);
      expect(result.generalNotes).toEqual(generalNotes.note);
    });

    it('should throw error on set general notes for a non existing member', async () => {
      const generalNotes = generateSetGeneralNotesParams();
      await expect(service.setGeneralNotes(generalNotes)).rejects.toThrow(
        Errors.get(ErrorType.memberNotFound),
      );
    });

    it('should set general notes', async () => {
      const memberId = generateId();
      const orgId = generateId();
      await service.create({ memberId, orgId });

      const notes = generateSetGeneralNotesParams({ memberId });
      await service.setGeneralNotes(notes);

      const result = await service.getRecent(memberId);
      expect(result.generalNotes).toEqual(notes.note);
    });

    it('should override general notes when provided', async () => {
      const memberId = generateId();
      const orgId = generateId();
      await service.create({ memberId, orgId });

      const notes1 = generateSetGeneralNotesParams({ memberId });
      await service.setGeneralNotes(notes1);

      const notes2 = generateSetGeneralNotesParams({ memberId });
      notes2.note = lorem.sentence();
      await service.setGeneralNotes(notes2);

      const result = await service.getRecent(memberId);
      expect(result.generalNotes).toEqual(notes2.note);
    });

    it('should be able to set empty notes similar to harmony calls', async () => {
      const memberId = generateId();
      const orgId = generateId();
      await service.create({ memberId, orgId });

      const params1 = generateSetGeneralNotesParams({ memberId });
      await service.setGeneralNotes(params1);
      const result1 = await service.getRecent(memberId);
      expect(result1.generalNotes).toEqual(params1.note);

      const params2 = generateSetGeneralNotesParams({ memberId, note: '' });
      await service.setGeneralNotes(params2);
      const result2 = await service.getRecent(memberId);
      expect(result2.generalNotes).toEqual(params2.note);
    });
  });

  describe('createOrSetActionItem', () => {
    it('should create an action item', async () => {
      const memberId = generateId();
      const orgId = generateId();
      await service.create({ memberId, orgId });
      const createActionItemParams = generateCreateOrSetActionItemParams({ memberId });
      const { id } = await service.createOrSetActionItem(createActionItemParams);

      expect(id).toEqual(expect.any(String));
    });

    it('should update an existing action item', async () => {
      const memberId = generateId();
      const orgId = generateId();
      await service.create({ memberId, orgId });
      const createActionItemParams = generateCreateOrSetActionItemParams({ memberId });
      const { id } = await service.createOrSetActionItem(createActionItemParams);

      const updateParams = generateCreateOrSetActionItemParams({ id });
      await service.createOrSetActionItem(updateParams);
      const results = await service.getActionItems(memberId);
      delete updateParams.memberId;

      expect(results).toEqual(
        expect.arrayContaining([expect.objectContaining({ ...updateParams })]),
      );
    });

    it('should override current params, even when undefined', async () => {
      const memberId = generateId();
      const orgId = generateId();
      await service.create({ memberId, orgId });
      const createActionItemParams = generateCreateOrSetActionItemParams({ memberId });
      const { id } = await service.createOrSetActionItem(createActionItemParams);

      const updateParams = generateCreateOrSetActionItemParams({ id });
      delete updateParams.category;
      delete updateParams.description;
      delete updateParams.memberId;
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
        service.createOrSetActionItem(
          generateCreateOrSetActionItemParams({ memberId: generateId() }),
        ),
      ).rejects.toThrow(Errors.get(ErrorType.memberNotFound));
    });
  });

  describe('getActionItems', () => {
    it(`should create and get member's action items`, async () => {
      const memberId = generateId();
      const orgId = generateId();
      await service.create({ memberId, orgId });
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

      const { id: id1 } = await service.createOrSetActionItem(createActionItemParams1);
      const { id: id2 } = await service.createOrSetActionItem(createActionItemParams2);

      delete createActionItemParams1.memberId;
      delete createActionItemParams2.memberId;
      const results = await service.getActionItems(memberId);
      expect(results.length).toEqual(2);
      expect(results).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            ...createActionItemParams2,
            id: id2,
            relatedEntities: [questionnaire],
            memberId: new Types.ObjectId(memberId),
          }),
          expect.objectContaining({
            ...createActionItemParams1,
            id: id1,
            memberId: new Types.ObjectId(memberId),
            // test default properties
            relatedEntities: [],
            status: ActionItemStatus.active,
            priority: ActionItemPriority.normal,
          }),
        ]),
      );
    });

    it('should return empty array on non existing action items per member', async () => {
      const memberId = generateId();
      const orgId = generateId();
      await service.create({ memberId, orgId });
      const results = await service.getActionItems(memberId);
      expect(results.length).toEqual(0);
    });
  });

  describe('handleUpdateRelatedEntityActionItem', () => {
    it('should update related entity in action items', async () => {
      const memberId = generateId();
      const orgId = generateId();
      await service.create({ memberId, orgId });
      const questionnaire = generateRelatedEntity({
        type: RelatedEntityType.questionnaire,
      });
      const createActionItemParams1 = generateCreateOrSetActionItemParams({
        memberId,
        relatedEntities: [questionnaire],
      });
      const { id } = await service.createOrSetActionItem(createActionItemParams1);

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
            ...createActionItemParams1,
            memberId: new Types.ObjectId(memberId),
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
      await service.create({ memberId, orgId });
      const results = await service.getActionItems(memberId);
      expect(results.length).toEqual(0);
    });
  });

  describe('createJournal', () => {
    it('should create journal', async () => {
      const memberId = generateId();
      const journeyId = generateId();

      const { id } = await service.createJournal(memberId, journeyId);
      const result = await modelJournal.findById(id);

      expect(result).toMatchObject({
        _id: id,
        memberId: new Types.ObjectId(memberId),
        published: false,
      });
    });
  });

  describe('updateJournal', () => {
    it('should update journal', async () => {
      const memberId = generateId();
      const journeyId = generateId();

      const { id } = await service.createJournal(memberId, journeyId);
      const updateJournalTextParams = generateUpdateJournalTextParams({ id });

      const journal = await service.updateJournal({
        ...updateJournalTextParams,
        memberId,
        journeyId,
      });
      const result = await modelJournal.findById(id);

      expect(result).toMatchObject(journal);
    });

    it(`should throw an error on update journal if another member`, async () => {
      const { id } = await service.createJournal(generateId(), generateId());
      await expect(
        service.updateJournal({
          ...generateUpdateJournalTextParams({ id }),
          memberId: generateId(),
          journeyId: generateId(),
        }),
      ).rejects.toThrow(Error(Errors.get(ErrorType.journeyJournalNotFound)));
    });

    it(`should throw an error on update journal when id doesn't exists`, async () => {
      await expect(
        service.updateJournal({
          ...generateUpdateJournalTextParams(),
          memberId: generateId(),
          journeyId: generateId(),
        }),
      ).rejects.toThrow(Error(Errors.get(ErrorType.journeyJournalNotFound)));
    });
  });

  describe('updateJournalImageFormat', () => {
    it('should update journal imageFormat', async () => {
      const memberId = generateId();
      const journeyId = generateId();

      const { id } = await service.createJournal(memberId, journeyId);
      const updateJournalImageFormatParams = generateGetMemberUploadJournalImageLinkParams({ id });

      const journal = await service.updateJournal({
        ...updateJournalImageFormatParams,
        memberId,
        journeyId,
      });
      const result = await modelJournal.findById(id);

      expect(result).toMatchObject(journal);
    });

    it(`should throw an error on update journal image format if another member`, async () => {
      const journeyId = generateId();
      const { id } = await service.createJournal(generateId(), journeyId);
      await expect(
        service.updateJournal({
          id,
          imageFormat: ImageFormat.png,
          memberId: generateId(),
          journeyId,
        }),
      ).rejects.toThrow(Error(Errors.get(ErrorType.journeyJournalNotFound)));
    });

    it(`should throw an error on update journal image format when id doesn't exists`, async () => {
      await expect(
        service.updateJournal({
          id: generateId(),
          imageFormat: ImageFormat.png,
          memberId: generateId(),
          journeyId: generateId(),
        }),
      ).rejects.toThrow(Error(Errors.get(ErrorType.journeyJournalNotFound)));
    });
  });

  describe('getJournal', () => {
    it('should get journal', async () => {
      const memberId = generateId();
      const journeyId = generateId();

      const { id } = await service.createJournal(memberId, journeyId);
      const updateJournalTextParams = generateUpdateJournalTextParams({ id });

      await service.updateJournal({ ...updateJournalTextParams, memberId, journeyId });

      const result = await modelJournal.findById(id);
      const journal = await service.getJournal(id, journeyId);

      expect(result).toMatchObject({
        _id: new Types.ObjectId(journal.id),
        memberId: new Types.ObjectId(journal.memberId),
        published: journal.published,
        text: journal.text,
        updatedAt: journal.updatedAt,
        createdAt: journal.createdAt,
      });
    });

    it(`should throw an error on get journal if another member access it`, async () => {
      const { id } = await service.createJournal(generateId(), generateId());
      await expect(service.getJournal(id, generateId())).rejects.toThrow(
        Error(Errors.get(ErrorType.journeyJournalNotFound)),
      );
    });

    it(`should throw an error on get journal when id doesn't exists`, async () => {
      await expect(service.getJournal(generateId(), generateId())).rejects.toThrow(
        Error(Errors.get(ErrorType.journeyJournalNotFound)),
      );
    });
  });

  describe('getJournals', () => {
    it('should get journals by journeyId', async () => {
      const memberId = generateId();
      const journeyId = generateId();

      const { id: journalId1 } = await service.createJournal(memberId, journeyId);
      const { id: journalId2 } = await service.createJournal(memberId, journeyId);
      const updateJournalTextParams1 = generateUpdateJournalTextParams({ id: journalId1 });
      const updateJournalTextParams2 = generateUpdateJournalTextParams({ id: journalId2 });

      await service.updateJournal({ ...updateJournalTextParams1, memberId, journeyId });
      await service.updateJournal({ ...updateJournalTextParams2, memberId, journeyId });

      const journals = await service.getJournals(journeyId);

      expect(journals).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            _id: new Types.ObjectId(journalId1),
            memberId: new Types.ObjectId(memberId),
            published: false,
            text: updateJournalTextParams1.text,
            updatedAt: expect.any(Date),
            createdAt: expect.any(Date),
          }),
          expect.objectContaining({
            _id: new Types.ObjectId(journalId2),
            memberId: new Types.ObjectId(memberId),
            published: false,
            text: updateJournalTextParams2.text,
            updatedAt: expect.any(Date),
            createdAt: expect.any(Date),
          }),
        ]),
      );
    });

    // eslint-disable-next-line max-len
    it(`should not get journals by journeyId if text or image or audio doesn't exists`, async () => {
      const memberId = generateId();
      const journeyId = generateId();
      const { id } = await service.createJournal(memberId, journeyId);

      const journals = await service.getJournals(journeyId);

      expect(journals.length).toBe(0);
      expect(journals).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            _id: new Types.ObjectId(id),
            memberId: new Types.ObjectId(memberId),
            published: false,
            text: expect.any(String),
            updatedAt: expect.any(Date),
            createdAt: expect.any(Date),
          }),
        ]),
      );
    });

    test.each([
      { text: lorem.sentence() },
      { imageFormat: ImageFormat.png },
      { audioFormat: AudioFormat.mp3 },
    ])(`should get journals by journeyId if text or image or audio exists`, async (param) => {
      const memberId = generateId();
      const journeyId = generateId();
      const { id } = await service.createJournal(memberId, journeyId);
      await service.updateJournal({ ...param, id, memberId, journeyId });

      const journals = await service.getJournals(journeyId);

      expect(journals.length).toBe(1);
      expect(journals).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            ...param,
            _id: new Types.ObjectId(id),
            memberId: new Types.ObjectId(memberId),
            published: false,
            updatedAt: expect.any(Date),
            createdAt: expect.any(Date),
          }),
        ]),
      );
    });

    it(`should return empty array if member doesn't have journals`, async () => {
      const memberId = generateId();
      const journals = await service.getJournals(memberId);

      expect(journals).toEqual([]);
    });

    it('should create and get journal for the same journey', async () => {
      const memberId = generateId();
      const journeyId1 = generateId();
      const journeyId2 = generateId();
      await service.createJournal(memberId, journeyId1);
      const { id } = await service.createJournal(memberId, journeyId2);

      await service.updateJournal({
        ...generateUpdateJournalTextParams({ id }),
        memberId,
        journeyId: journeyId2,
      });

      const journals = await service.getJournals(journeyId2);
      expect(journals.length).toEqual(1);
      expect(journals[0].id).toEqual(id.toString());
    });
  });

  describe('deleteJournal', () => {
    it('should delete journal', async () => {
      const memberId = generateId();
      const journeyId = generateId();
      const { id } = await service.createJournal(memberId, journeyId);

      await service.getJournal(id, journeyId);
      const journalDelete = await service.deleteJournal(id, memberId);

      expect(journalDelete).toBeTruthy();

      await expect(service.getJournal(id, journeyId)).rejects.toThrow(
        Error(Errors.get(ErrorType.journeyJournalNotFound)),
      );
    });

    it(`should throw an error on delete journal if another member`, async () => {
      const { id } = await service.createJournal(generateId(), generateId());
      await expect(service.deleteJournal(id, generateId())).rejects.toThrow(
        Error(Errors.get(ErrorType.journeyJournalNotFound)),
      );
    });

    it(`should throw an error on delete journal when id doesn't exists`, async () => {
      await expect(service.deleteJournal(generateId(), generateId())).rejects.toThrow(
        Error(Errors.get(ErrorType.journeyJournalNotFound)),
      );
    });
  });
});
