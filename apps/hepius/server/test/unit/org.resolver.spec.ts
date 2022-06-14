import { UserRole } from '@argus/hepiusClient';
import { generateId, mockLogger, mockProcessWarnings } from '@argus/pandora';
import { Test, TestingModule } from '@nestjs/testing';
import { dbDisconnect, defaultModules, generateOrgParams, mockGenerateOrg } from '..';
import { LoggerService } from '../../src/common';
import { OrgModule, OrgResolver, OrgService } from '../../src/org';

describe('OrgResolver', () => {
  let module: TestingModule;
  let resolver: OrgResolver;
  let service: OrgService;

  beforeAll(async () => {
    mockProcessWarnings(); // to hide pino prettyPrint warning
    module = await Test.createTestingModule({
      imports: defaultModules().concat(OrgModule),
    }).compile();

    resolver = module.get<OrgResolver>(OrgResolver);
    service = module.get<OrgService>(OrgService);
    mockLogger(module.get<LoggerService>(LoggerService));
  });

  afterAll(async () => {
    await module.close();
    await dbDisconnect();
  });

  describe('createOrg', () => {
    let spyOnServiceInsert;
    beforeEach(() => {
      spyOnServiceInsert = jest.spyOn(service, 'insert');
    });

    afterEach(() => {
      spyOnServiceInsert.mockReset();
    });

    it('should successfully create an org', async () => {
      const id = generateId();
      spyOnServiceInsert.mockImplementationOnce(() => id);

      const params = generateOrgParams();
      const result = await resolver.createOrg(params);

      expect(spyOnServiceInsert).toBeCalledTimes(1);
      expect(spyOnServiceInsert).toBeCalledWith(params);
      expect(result).toEqual(id);
    });
  });

  describe('getOrg', () => {
    let spyOnServiceGet;
    beforeEach(() => {
      spyOnServiceGet = jest.spyOn(service, 'get');
    });

    afterEach(() => {
      spyOnServiceGet.mockReset();
    });

    it('should successfully get org by id', async () => {
      const generatedOrgParams = generateOrgParams();
      spyOnServiceGet.mockImplementationOnce(() => generatedOrgParams);

      const id = generateId();
      const result = await resolver.getOrg(undefined, [UserRole.lagunaAdmin], id);

      expect(spyOnServiceGet).toBeCalledTimes(1);
      expect(spyOnServiceGet).toBeCalledWith(id);
      expect(result).toEqual(generatedOrgParams);
    });
  });

  describe('getOrgs', () => {
    let spyOnServiceGetOrgs;
    beforeEach(() => {
      spyOnServiceGetOrgs = jest.spyOn(service, 'getOrgs');
    });

    afterEach(() => {
      spyOnServiceGetOrgs.mockReset();
    });

    it('should successfully get org by id', async () => {
      const orgs = [mockGenerateOrg(), mockGenerateOrg(), mockGenerateOrg()];
      spyOnServiceGetOrgs.mockImplementationOnce(() => orgs);

      const result = await resolver.getOrgs();

      expect(spyOnServiceGetOrgs).toBeCalledTimes(1);
      expect(result).toEqual(orgs);
    });
  });
});
