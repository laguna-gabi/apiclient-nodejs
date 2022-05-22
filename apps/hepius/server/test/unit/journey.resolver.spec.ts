import { generateSetGeneralNotesParams, generateUpdateJourneyParams } from '../generators';
import { Test, TestingModule } from '@nestjs/testing';
import {
  AdmissionService,
  JourneyModule,
  JourneyResolver,
  JourneyService,
} from '../../src/journey';
import { generateId, mockLogger, mockProcessWarnings } from '@argus/pandora';
import { dbDisconnect, defaultModules } from '../common';
import { LoggerService } from '../../src/common';

describe(JourneyResolver.name, () => {
  let module: TestingModule;
  let resolver: JourneyResolver;
  let service: JourneyService;
  let admissionService: AdmissionService;

  beforeAll(async () => {
    mockProcessWarnings(); // to hide pino prettyPrint warning
    module = await Test.createTestingModule({
      imports: defaultModules().concat(JourneyModule),
    }).compile();

    resolver = module.get<JourneyResolver>(JourneyResolver);
    service = module.get<JourneyService>(JourneyService);
    admissionService = module.get<AdmissionService>(AdmissionService);
    mockLogger(module.get<LoggerService>(LoggerService));
  });

  afterAll(async () => {
    await module.close();
    await dbDisconnect();
  });

  describe('Journey', () => {
    let spyOnServiceUpdate: jest.SpyInstance;
    let spyOnServiceGetAll: jest.SpyInstance;
    let spyOnServiceGet: jest.SpyInstance;
    let spyOnServiceGetRecent: jest.SpyInstance;

    beforeEach(() => {
      spyOnServiceUpdate = jest.spyOn(service, 'update');
      spyOnServiceGetAll = jest.spyOn(service, 'getAll');
      spyOnServiceGet = jest.spyOn(service, 'get');
      spyOnServiceGetRecent = jest.spyOn(service, 'getRecent');
    });

    afterEach(() => {
      spyOnServiceUpdate.mockReset();
      spyOnServiceGetAll.mockReset();
      spyOnServiceGet.mockReset();
      spyOnServiceGetRecent.mockReset();
    });

    it('should update a journey', async () => {
      spyOnServiceUpdate.mockResolvedValueOnce(null);
      await resolver.updateJourney(generateUpdateJourneyParams());

      expect(spyOnServiceUpdate).toBeCalled();
    });

    it('should get all journeys', async () => {
      spyOnServiceGetAll.mockResolvedValueOnce([generateUpdateJourneyParams()]);
      await resolver.getJourneys(generateId());

      expect(spyOnServiceGetAll).toBeCalled();
    });

    it('should get a journey', async () => {
      spyOnServiceGet.mockResolvedValueOnce(generateUpdateJourneyParams());
      await resolver.getJourney(generateId());

      expect(spyOnServiceGet).toBeCalled();
    });

    it('should get recent journey', async () => {
      spyOnServiceGet.mockResolvedValueOnce(generateUpdateJourneyParams());
      await resolver.getRecentJourney(generateId());

      expect(spyOnServiceGetRecent).toBeCalled();
    });
  });

  describe('Admission', () => {
    let spyOnServiceGetMemberAdmission: jest.SpyInstance;
    let spyOnServiceChangeMemberDna: jest.SpyInstance;

    beforeEach(() => {
      spyOnServiceGetMemberAdmission = jest.spyOn(admissionService, 'get');
      spyOnServiceChangeMemberDna = jest.spyOn(admissionService, 'change');
    });

    afterEach(() => {
      spyOnServiceGetMemberAdmission.mockReset();
      spyOnServiceChangeMemberDna.mockReset();
    });

    it('should call get member admission', async () => {
      spyOnServiceGetMemberAdmission.mockResolvedValueOnce(undefined);

      const memberId = generateId();
      await resolver.getMemberAdmissions(memberId);

      expect(spyOnServiceGetMemberAdmission).toBeCalledWith(memberId);
    });

    it('should call change member admission', async () => {
      spyOnServiceChangeMemberDna.mockResolvedValueOnce(undefined);

      const memberId = generateId();
      await resolver.changeMemberDna([], { memberId });

      expect(spyOnServiceChangeMemberDna).toBeCalledWith({ memberId });
    });

    it('should return dietary matcher', async () => {
      const result = await resolver.getAdmissionsDietaryMatcher();
      expect(result.map.length).toEqual(17);
    });
  });

  describe('setGeneralNotes', () => {
    let spyOnServiceSetGeneralNotes;
    beforeEach(() => {
      spyOnServiceSetGeneralNotes = jest.spyOn(service, 'setGeneralNotes');
    });

    afterEach(() => {
      spyOnServiceSetGeneralNotes.mockReset();
    });

    it('should set general notes', async () => {
      spyOnServiceSetGeneralNotes.mockImplementationOnce(async () => undefined);

      const params = generateSetGeneralNotesParams();
      await resolver.setGeneralNotes(params);

      expect(spyOnServiceSetGeneralNotes).toBeCalledTimes(1);
      expect(spyOnServiceSetGeneralNotes).toBeCalledWith(params);
    });
  });
});
