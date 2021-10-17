import { EventEmitterModule } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { DbModule } from '../../src/db/db.module';
import { OrgModule, OrgResolver, OrgService } from '../../src/org';
import { dbDisconnect, generateId, generateOrgParams } from '../index';

describe('OrgResolver', () => {
  let module: TestingModule;
  let resolver: OrgResolver;
  let service: OrgService;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [DbModule, OrgModule, EventEmitterModule.forRoot()],
    }).compile();

    resolver = module.get<OrgResolver>(OrgResolver);
    service = module.get<OrgService>(OrgService);
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
      const result = await resolver.getOrg(id);

      expect(spyOnServiceGet).toBeCalledTimes(1);
      expect(spyOnServiceGet).toBeCalledWith(id);
      expect(result).toEqual(generatedOrgParams);
    });
  });
});
