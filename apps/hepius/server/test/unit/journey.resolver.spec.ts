import {
  generateId,
  generateSetGeneralNotesParams,
  generateUpdateJourneyParams,
} from '../generators';
import { Test, TestingModule } from '@nestjs/testing';
import {
  AdmissionService,
  GraduateMemberParams,
  JourneyResolver,
  JourneyService,
  MemberModule,
  MemberService,
} from '../../src/member';
import { Platform, mockLogger, mockProcessWarnings } from '@argus/pandora';
import { dbDisconnect, defaultModules } from '../common';
import { LoggerService } from '../../src/common';
import { CognitoService } from '../../src/providers';
import { v4 } from 'uuid';

describe(JourneyResolver.name, () => {
  let module: TestingModule;
  let resolver: JourneyResolver;
  let service: JourneyService;
  let admissionService: AdmissionService;
  let memberService: MemberService;
  let cognitoService: CognitoService;

  beforeAll(async () => {
    mockProcessWarnings(); // to hide pino prettyPrint warning
    module = await Test.createTestingModule({
      imports: defaultModules().concat(MemberModule),
    }).compile();

    resolver = module.get<JourneyResolver>(JourneyResolver);
    service = module.get<JourneyService>(JourneyService);
    admissionService = module.get<AdmissionService>(AdmissionService);
    memberService = module.get<MemberService>(MemberService);
    cognitoService = module.get<CognitoService>(CognitoService);
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
    let spyOnServiceGetActive: jest.SpyInstance;

    beforeEach(() => {
      spyOnServiceUpdate = jest.spyOn(service, 'update');
      spyOnServiceGetAll = jest.spyOn(service, 'getAll');
      spyOnServiceGet = jest.spyOn(service, 'get');
      spyOnServiceGetActive = jest.spyOn(service, 'getActive');
    });

    afterEach(() => {
      spyOnServiceUpdate.mockReset();
      spyOnServiceGetAll.mockReset();
      spyOnServiceGet.mockReset();
      spyOnServiceGetActive.mockReset();
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

    it('should get active journey', async () => {
      spyOnServiceGet.mockResolvedValueOnce(generateUpdateJourneyParams());
      await resolver.getActiveJourney(generateId());

      expect(spyOnServiceGetActive).toBeCalled();
    });

    describe('graduateMember', () => {
      let spyOnServiceGetAll;
      let spyOnServiceGetMember;
      let spyOnServiceGetMemberConfig;
      let spyOnServiceGraduate;
      let spyOnCognitoServiceEnableClient;
      let spyOnCognitoServiceDisableClient;

      beforeEach(() => {
        spyOnServiceGetAll = jest.spyOn(service, 'getAll');
        spyOnServiceGetMember = jest.spyOn(memberService, 'get');
        spyOnServiceGetMemberConfig = jest.spyOn(memberService, 'getMemberConfig');
        spyOnServiceGraduate = jest.spyOn(service, 'graduate');
        spyOnCognitoServiceEnableClient = jest.spyOn(cognitoService, 'enableClient');
        spyOnCognitoServiceDisableClient = jest.spyOn(cognitoService, 'disableClient');
      });

      afterEach(() => {
        spyOnServiceGetAll.mockReset();
        spyOnServiceGetMember.mockReset();
        spyOnServiceGetMemberConfig.mockReset();
        spyOnServiceGraduate.mockReset();
        spyOnCognitoServiceEnableClient.mockReset();
        spyOnCognitoServiceDisableClient.mockReset();
      });

      test.each([Platform.web, Platform.android, Platform.ios])(
        'should graduate an existing member(true)',
        async (platform) => {
          const deviceId = v4();
          spyOnServiceGetAll.mockResolvedValue([{ isGraduated: false }]);
          spyOnServiceGetMember.mockResolvedValue({ deviceId });
          spyOnServiceGetMemberConfig.mockResolvedValue({ platform });
          spyOnServiceGraduate.mockResolvedValue(undefined);
          spyOnCognitoServiceDisableClient.mockResolvedValue(true);

          const graduateMemberParams: GraduateMemberParams = {
            id: generateId(),
            isGraduated: true,
          };
          await resolver.graduateMember(graduateMemberParams);
          if (platform !== Platform.web) {
            expect(spyOnCognitoServiceDisableClient).toBeCalledWith(deviceId);
          } else {
            expect(spyOnCognitoServiceEnableClient).not.toBeCalled();
          }
          expect(spyOnCognitoServiceEnableClient).not.toBeCalled();
          expect(spyOnServiceGraduate).toBeCalledWith(graduateMemberParams);
        },
      );

      test.each([Platform.web, Platform.android, Platform.ios])(
        'should graduate an existing member(false)',
        async (platform) => {
          const deviceId = v4();
          spyOnServiceGetAll.mockResolvedValue([{ isGraduated: true }]);
          spyOnServiceGetMember.mockResolvedValue({ deviceId });
          spyOnServiceGetMemberConfig.mockResolvedValue({ platform });
          spyOnServiceGraduate.mockResolvedValue(undefined);
          spyOnCognitoServiceDisableClient.mockResolvedValue(true);

          const graduateMemberParams: GraduateMemberParams = {
            id: generateId(),
            isGraduated: false,
          };
          await resolver.graduateMember(graduateMemberParams);
          if (platform !== Platform.web) {
            expect(spyOnCognitoServiceEnableClient).toBeCalledWith(deviceId);
          } else {
            expect(spyOnCognitoServiceEnableClient).not.toBeCalled();
          }
          expect(spyOnCognitoServiceDisableClient).not.toBeCalled();
          expect(spyOnServiceGraduate).toBeCalledWith(graduateMemberParams);
        },
      );

      [Platform.web, Platform.android, Platform.ios].forEach((platform) => {
        test.each([true, false])(
          'should not update isGraduated to %p since it is already %p',
          async (isGraduated) => {
            const deviceId = v4();
            spyOnServiceGetAll.mockResolvedValue([{ isGraduated }]);
            spyOnServiceGetMember.mockResolvedValue({ deviceId });
            spyOnServiceGetMemberConfig.mockResolvedValue({ platform });
            spyOnServiceGraduate.mockResolvedValue(undefined);
            spyOnCognitoServiceDisableClient.mockResolvedValue(true);

            const graduateMemberParams: GraduateMemberParams = { id: generateId(), isGraduated };
            await resolver.graduateMember(graduateMemberParams);
            expect(spyOnServiceGraduate).not.toBeCalled();
            expect(spyOnCognitoServiceDisableClient).not.toBeCalled();
            expect(spyOnCognitoServiceEnableClient).not.toBeCalled();
          },
        );
      });
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
