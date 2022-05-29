import { generateId, mockLogger, mockProcessWarnings } from '@argus/pandora';
import { Test, TestingModule } from '@nestjs/testing';
import { ErrorType, Errors, LoggerService } from '../../src/common';
import { MemberModule } from '../../src/member';
import {
  ActionItemStatus,
  JourneyService,
  ReadmissionRisk,
  UpdateJourneyParams,
} from '../../src/journey';
import {
  dbConnect,
  dbDisconnect,
  defaultModules,
  generateCreateActionItemParams,
  generateCreateJourneyParams,
  generateSetGeneralNotesParams,
  generateUpdateActionItemStatusParams,
  generateUpdateJourneyParams,
} from '../index';
import { Types } from 'mongoose';
import { lorem } from 'faker';

describe(JourneyService.name, () => {
  let module: TestingModule;
  let service: JourneyService;

  beforeAll(async () => {
    mockProcessWarnings(); // to hide pino prettyPrint warning
    module = await Test.createTestingModule({
      imports: defaultModules().concat(MemberModule),
    }).compile();

    service = module.get<JourneyService>(JourneyService);
    mockLogger(module.get<LoggerService>(LoggerService));

    await dbConnect();
  });

  afterAll(async () => {
    await module.close();
    await dbDisconnect();
  });

  it('should create multiple journeys and return them', async () => {
    const memberId = generateId();

    const { id: id1 } = await service.create(generateCreateJourneyParams({ memberId }));
    const { id: id2 } = await service.create(generateCreateJourneyParams({ memberId }));

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

  describe('updateMemberConfigLoggedInAt', () => {
    it('should update member config login time and not update firstLogin on 2nd time', async () => {
      const memberId = generateId();
      await service.create(generateCreateJourneyParams({ memberId }));

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
    const memberIdTestGroup = generateId();
    const { id: journeyId1 } = await service.create(generateCreateJourneyParams({ memberId }));
    const { id: journeyId2 } = await service.create(generateCreateJourneyParams({ memberId }));
    const { id: journeyIdMemberTestGroup } = await service.create({
      memberId: memberIdTestGroup,
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
      const { id } = await service.create(generateCreateJourneyParams({ memberId }));

      const { id: updateResultId } = await service.update(
        generateUpdateJourneyParams({ memberId }),
      );
      expect(id.toString()).toEqual(updateResultId);
    });

    it('should return existing journey when no update params provided(with id)', async () => {
      const memberId = generateId();
      await service.create(generateCreateJourneyParams({ memberId }));
      await checkUpdate({ memberId });
    });

    it('should multiple update item', async () => {
      const memberId = generateId();
      await service.create(generateCreateJourneyParams({ memberId }));

      await checkUpdate(generateUpdateJourneyParams({ memberId }));
      await checkUpdate(generateUpdateJourneyParams({ memberId }));
    });

    it('should be able to update partial fields', async () => {
      const memberId = generateId();
      await service.create(generateCreateJourneyParams({ memberId }));

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
      await service.create(generateCreateJourneyParams({ memberId }));

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
      await service.create(generateCreateJourneyParams({ memberId }));

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
        const { id } = await service.create(generateCreateJourneyParams({ memberId }));
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
      await service.create(generateCreateJourneyParams({ memberId }));

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
      await service.create(generateCreateJourneyParams({ memberId }));

      const notes = generateSetGeneralNotesParams({ memberId });
      delete notes.nurseNotes;
      await service.setGeneralNotes(notes);

      const result = await service.getRecent(memberId);
      expect(result.generalNotes).toEqual(notes.note);
      expect(result.nurseNotes).toBeUndefined();
    });

    it('should set nurse notes', async () => {
      const memberId = generateId();
      await service.create(generateCreateJourneyParams({ memberId }));

      const notes = generateSetGeneralNotesParams({ memberId });
      delete notes.note;
      await service.setGeneralNotes(notes);

      const result = await service.getRecent(memberId);

      expect(result.nurseNotes).toEqual(notes.nurseNotes);
      expect(result.generalNotes).toBeUndefined();
    });

    it('should override general notes when provided', async () => {
      const memberId = generateId();
      await service.create(generateCreateJourneyParams({ memberId }));

      const notes1 = generateSetGeneralNotesParams({ memberId });
      await service.setGeneralNotes(notes1);

      const notes2 = generateSetGeneralNotesParams({ memberId });
      notes2.note = lorem.sentence();
      delete notes2.nurseNotes;
      await service.setGeneralNotes(notes2);

      const result = await service.getRecent(memberId);

      expect(result.nurseNotes).toEqual(notes1.nurseNotes);
      expect(result.generalNotes).toEqual(notes2.note);
    });

    it('should override nurse notes when provided', async () => {
      const memberId = generateId();
      await service.create(generateCreateJourneyParams({ memberId }));

      const notes1 = generateSetGeneralNotesParams({ memberId });
      await service.setGeneralNotes(notes1);

      const notes2 = generateSetGeneralNotesParams({ memberId });
      notes2.nurseNotes = lorem.sentence();
      delete notes2.note;
      await service.setGeneralNotes(notes2);

      const result = await service.getRecent(memberId);

      expect(result.nurseNotes).toEqual(notes2.nurseNotes);
      expect(result.generalNotes).toEqual(notes1.note);
    });

    it('should set notes and then nurse notes', async () => {
      const memberId = generateId();
      await service.create(generateCreateJourneyParams({ memberId }));

      const notes1 = generateSetGeneralNotesParams({ memberId });
      delete notes1.nurseNotes;
      await service.setGeneralNotes(notes1);

      const notes2 = generateSetGeneralNotesParams({ memberId });
      delete notes2.note;
      await service.setGeneralNotes(notes2);

      const result = await service.getRecent(memberId);

      expect(result.nurseNotes).toEqual(notes2.nurseNotes);
      expect(result.generalNotes).toEqual(notes1.note);
    });

    it('should set nurse notes and then general notes', async () => {
      const memberId = generateId();
      await service.create(generateCreateJourneyParams({ memberId }));

      const notes1 = generateSetGeneralNotesParams({ memberId });
      delete notes1.note;
      await service.setGeneralNotes(notes1);

      const notes2 = generateSetGeneralNotesParams({ memberId });
      delete notes2.nurseNotes;
      await service.setGeneralNotes(notes2);

      const result = await service.getRecent(memberId);

      expect(result.nurseNotes).toEqual(notes1.nurseNotes);
      expect(result.generalNotes).toEqual(notes2.note);
    });

    it('should be able to set empty notes or generalNotes similar to harmony calls', async () => {
      const memberId = generateId();
      await service.create(generateCreateJourneyParams({ memberId }));

      const params1 = generateSetGeneralNotesParams({ memberId });
      await service.setGeneralNotes(params1);
      const result1 = await service.getRecent(memberId);
      expect(result1.nurseNotes).toEqual(params1.nurseNotes);
      expect(result1.generalNotes).toEqual(params1.note);

      const params2 = generateSetGeneralNotesParams({ memberId, note: '' });
      delete params2.nurseNotes;
      await service.setGeneralNotes(params2);
      const result2 = await service.getRecent(memberId);
      expect(result2.nurseNotes).toEqual(params1.nurseNotes);
      expect(result2.generalNotes).toEqual(params2.note);

      const params3 = generateSetGeneralNotesParams({ memberId, nurseNotes: '' });
      delete params3.note;
      await service.setGeneralNotes(params3);
      const result3 = await service.getRecent(memberId);
      expect(result3.nurseNotes).toEqual(params3.nurseNotes);
      expect(result3.generalNotes).toEqual(params2.note);
    });
  });

  describe('insertActionItem', () => {
    it('should insert an action item', async () => {
      const memberId = generateId();
      await service.create(generateCreateJourneyParams({ memberId }));
      const createActionItemParams = generateCreateActionItemParams({ memberId });
      const { id } = await service.insertActionItem({
        createActionItemParams: createActionItemParams,
        status: ActionItemStatus.pending,
      });

      expect(id).toEqual(expect.any(Types.ObjectId));
    });
  });

  describe('updateActionItemStatus', () => {
    it('should update an existing action item status', async () => {
      const memberId = generateId();
      await service.create(generateCreateJourneyParams({ memberId }));
      const createActionItemParams = generateCreateActionItemParams({ memberId });
      const { id } = await service.insertActionItem({
        createActionItemParams: createActionItemParams,
        status: ActionItemStatus.pending,
      });

      const status = ActionItemStatus.reached;
      await service.updateActionItemStatus({ id, status });
      const results = await service.getActionItems(memberId);
      expect(results[0].status).toEqual(status);
    });

    it('should not be able to update status for a non existing action item', async () => {
      await expect(
        service.updateActionItemStatus(generateUpdateActionItemStatusParams()),
      ).rejects.toThrow(Errors.get(ErrorType.journeyActionItemIdNotFound));
    });
  });

  describe('getActionItems', () => {
    it('should get existing action items', async () => {
      const memberId = generateId();
      await service.create(generateCreateJourneyParams({ memberId }));
      const createActionItemParams1 = generateCreateActionItemParams({ memberId });
      const createActionItemParams2 = generateCreateActionItemParams({ memberId });
      await service.insertActionItem({
        createActionItemParams: createActionItemParams1,
        status: ActionItemStatus.pending,
      });
      await service.insertActionItem({
        createActionItemParams: createActionItemParams2,
        status: ActionItemStatus.reached,
      });

      const results = await service.getActionItems(memberId);
      expect(results.length).toEqual(2);
      expect(results[0]).toMatchObject({
        ...createActionItemParams2,
        status: ActionItemStatus.reached,
      });
      expect(results[1]).toMatchObject({
        ...createActionItemParams1,
        status: ActionItemStatus.pending,
      });
    });

    it('should return empty array on non existing action items per member', async () => {
      const memberId = generateId();
      await service.create(generateCreateJourneyParams({ memberId }));
      const results = await service.getActionItems(memberId);
      expect(results.length).toEqual(0);
    });
  });
});
