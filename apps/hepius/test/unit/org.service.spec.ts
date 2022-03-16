import { mockLogger, mockProcessWarnings } from '@argus/pandora';
import { Test, TestingModule } from '@nestjs/testing';
import { ErrorType, Errors, LoggerService } from '../../src/common';
import { OrgModule, OrgService, OrgType } from '../../src/org';
import { generateId } from '../generators';
import { dbConnect, dbDisconnect, defaultModules, generateOrgParams } from '../index';

describe('OrgService', () => {
  let module: TestingModule;
  let service: OrgService;

  beforeAll(async () => {
    mockProcessWarnings(); // to hide pino prettyPrint warning
    module = await Test.createTestingModule({
      imports: defaultModules().concat(OrgModule),
    }).compile();

    service = module.get<OrgService>(OrgService);
    mockLogger(module.get<LoggerService>(LoggerService));

    await dbConnect();
  });

  afterAll(async () => {
    await module.close();
    await dbDisconnect();
  });

  describe('get + insert', () => {
    it('should successfully insert and the get org', async () => {
      const org = generateOrgParams();
      const { id } = await service.insert(org);

      const createdOrg = await service.get(id);
      expect(createdOrg).toEqual(expect.objectContaining(org));
    });

    test.each([OrgType.hospital, OrgType.service])(
      'should successfully insert a org having types : %p',
      async (type) => {
        const org = generateOrgParams({ type });
        const { id } = await service.insert(org);

        const createdOrg = await service.get(id);
        expect(createdOrg).toEqual(expect.objectContaining(org));
      },
    );

    it('should fail to insert an already existing org', async () => {
      const org1 = generateOrgParams();
      await service.insert(org1);
      const org2 = generateOrgParams({ name: org1.name });

      await expect(service.insert(org2)).rejects.toThrow(Errors.get(ErrorType.orgAlreadyExists));
    });

    it('should return null for non existing org', async () => {
      const createdOrg = await service.get(generateId());
      expect(createdOrg).toBeNull();
    });
  });
});
