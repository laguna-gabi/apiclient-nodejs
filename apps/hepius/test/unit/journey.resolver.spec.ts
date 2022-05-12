import { generateId } from '../generators';
import { Test, TestingModule } from '@nestjs/testing';
import { AdmissionService, JourneyResolver, MemberModule } from '../../src/member';
import { mockLogger, mockProcessWarnings } from '@argus/pandora';
import { dbDisconnect, defaultModules } from '../common';
import { LoggerService } from '../../src/common';

describe(JourneyResolver.name, () => {
  let module: TestingModule;
  let resolver: JourneyResolver;
  let admissionService: AdmissionService;

  beforeAll(async () => {
    mockProcessWarnings(); // to hide pino prettyPrint warning
    module = await Test.createTestingModule({
      imports: defaultModules().concat(MemberModule),
    }).compile();

    resolver = module.get<JourneyResolver>(JourneyResolver);
    admissionService = module.get<AdmissionService>(AdmissionService);
    mockLogger(module.get<LoggerService>(LoggerService));
  });

  afterAll(async () => {
    await module.close();
    await dbDisconnect();
  });

  describe('MemberAdmission', () => {
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
});
