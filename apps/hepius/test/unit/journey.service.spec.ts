import { mockLogger, mockProcessWarnings } from '@argus/pandora';
import { Test, TestingModule } from '@nestjs/testing';
import { ErrorType, Errors, LoggerService } from '../../src/common';
import { JourneyService, MemberModule } from '../../src/member';
import { dbConnect, dbDisconnect, defaultModules, generateId } from '../index';
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

    const { id: id1 } = await service.create({ memberId });
    const { id: id2 } = await service.create({ memberId });

    expect(id1).not.toEqual(id2);

    const matchObject = { memberId: new Types.ObjectId(memberId), admissions: [] };
    const result = await service.get(id2);
    expect(result).toMatchObject({ id: id2, ...matchObject, isActive: true });

    const results = await service.getAll({ memberId });
    expect(results).toMatchObject([
      { id: id1, ...matchObject, isActive: false },
      { id: id2, ...matchObject, isActive: true },
    ]);

    const activeJourney = await service.getActive(memberId);
    expect(activeJourney).toMatchObject({ id: id2, ...matchObject, isActive: true });
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
      await service.create({ memberId });

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
});
