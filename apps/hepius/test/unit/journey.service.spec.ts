import { mockLogger, mockProcessWarnings } from '@argus/pandora';
import { Test, TestingModule } from '@nestjs/testing';
import { ErrorType, Errors, LoggerService } from '../../src/common';
import {
  JourneyService,
  MemberModule,
  ReadmissionRisk,
  UpdateJourneyParams,
} from '../../src/member';
import {
  dbConnect,
  dbDisconnect,
  defaultModules,
  generateCreateJourneyParams,
  generateId,
  generateUpdateJourneyParams,
} from '../index';
import { Types } from 'mongoose';

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
    expect(result).toMatchObject({ id: id2, ...matchObject, active: true });

    const results = await service.getAll({ memberId });
    expect(results).toMatchObject([
      { id: id2, ...matchObject, active: true },
      { id: id1, ...matchObject, active: false },
    ]);

    const activeJourney = await service.getActive(memberId);
    expect(activeJourney).toMatchObject({ id: id2, ...matchObject, active: true });
  });

  it('should throw exception on journey not found', async () => {
    await expect(service.get(generateId())).rejects.toThrow(Errors.get(ErrorType.journeyNotFound));
  });

  it('should return empty journey list', async () => {
    const result = await service.getAll({ memberId: generateId() });
    expect(result).toHaveLength(0);
  });

  it('should fail to get active journey of a member', async () => {
    await expect(service.getActive(generateId())).rejects.toThrow(
      Errors.get(ErrorType.journeyForMemberNotFound),
    );
  });

  describe('updateMemberConfigLoggedInAt', () => {
    it('should update member config login time and not update firstLogin on 2nd time', async () => {
      const memberId = generateId();
      await service.create(generateCreateJourneyParams({ memberId }));

      const currentTime1 = new Date().getTime();
      await service.updateLoggedInAt(new Types.ObjectId(memberId));

      const journey1 = await service.getActive(memberId);
      expect(journey1.firstLoggedInAt.getTime()).toBeGreaterThanOrEqual(currentTime1);
      expect(journey1.lastLoggedInAt.getTime()).toBeGreaterThanOrEqual(currentTime1);

      const currentTime2 = new Date().getTime();
      await service.updateLoggedInAt(new Types.ObjectId(memberId));

      const journey2 = await service.getActive(memberId);
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
    it('should throw error when memberId and id doesnt match', async () => {
      await expect(
        service.update(generateUpdateJourneyParams({ memberId: generateId(), id: generateId() })),
      ).rejects.toThrow(Errors.get(ErrorType.journeyMemberIdAndOrIdNotFound));
    });

    it('should throw error when id does not exist with memberId', async () => {
      const memberId = generateId();
      await service.create(generateCreateJourneyParams({ memberId }));

      await expect(
        service.update(generateUpdateJourneyParams({ memberId, id: generateId() })),
      ).rejects.toThrow(Errors.get(ErrorType.journeyMemberIdAndOrIdNotFound));
    });

    it('should throw error when memberId does not exist with id', async () => {
      const memberId = generateId();
      const { id } = await service.create(generateCreateJourneyParams({ memberId }));

      await expect(
        service.update(generateUpdateJourneyParams({ memberId: generateId(), id })),
      ).rejects.toThrow(Errors.get(ErrorType.journeyMemberIdAndOrIdNotFound));
    });

    it('should return existing journey when no update params provided(without id)', async () => {
      const memberId = generateId();
      const { id } = await service.create(generateCreateJourneyParams({ memberId }));

      const { id: updateResultId } = await service.update(
        generateUpdateJourneyParams({ memberId }),
      );
      expect(id).toEqual(updateResultId);
    });

    it('should return existing journey when no update params provided(with id)', async () => {
      const memberId = generateId();
      const { id } = await service.create(generateCreateJourneyParams({ memberId }));

      await checkUpdate({ memberId, id });
    });

    it('should multiple update item', async () => {
      const memberId = generateId();
      const { id } = await service.create(generateCreateJourneyParams({ memberId }));

      await checkUpdate(generateUpdateJourneyParams({ memberId, id }));
      await checkUpdate(generateUpdateJourneyParams({ memberId, id }));
    });

    it('should be able to update partial fields', async () => {
      const memberId = generateId();
      const { id } = await service.create(generateCreateJourneyParams({ memberId }));

      const updateParams1 = generateUpdateJourneyParams({ memberId, id });
      await checkUpdate(updateParams1);

      const updateParams2 = generateUpdateJourneyParams({ memberId, id });
      delete updateParams2.fellowName;
      await checkUpdate(updateParams2);

      const active = await service.getActive(memberId);
      expect(active).toEqual(
        expect.objectContaining({
          ...updateParams2,
          fellowName: updateParams1.fellowName,
          memberId: new Types.ObjectId(memberId),
        }),
      );
    });

    it('should not add to readmissionRiskHistory if the readmissionRisk is the same', async () => {
      const memberId = generateId();
      const { id } = await service.create(generateCreateJourneyParams({ memberId }));

      const updateJourney = generateUpdateJourneyParams({
        memberId,
        id,
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
      const { id } = await service.create(generateCreateJourneyParams({ memberId }));

      const updateJourney1 = generateUpdateJourneyParams({
        memberId,
        id,
        readmissionRisk: ReadmissionRisk.low,
      });

      const updateJourneyResult1 = await service.update(updateJourney1);
      expect(updateJourneyResult1.readmissionRiskHistory.length).toEqual(1);

      const updateJourney2 = generateUpdateJourneyParams({
        memberId,
        id,
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
      expect(updateParams.id).toEqual(result.id);
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
});
