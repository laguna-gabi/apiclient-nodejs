import { Test, TestingModule } from '@nestjs/testing';
import { dbDisconnect, generateOrgParams } from '../index';
import { DbModule } from '../../src/db/db.module';
import { Types } from 'mongoose';
import { OrgModule, OrgResolver, OrgService } from '../../src/org';
import { EventEmitterModule } from '@nestjs/event-emitter';

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

    describe('createOrg', () => {
      it('should successfully create an org', async () => {
        const params = generateOrgParams();
        spyOnServiceInsert.mockImplementationOnce(async () => ({
          id: new Types.ObjectId().toString(),
          ...params,
        }));

        await resolver.createOrg(params);

        expect(spyOnServiceInsert).toBeCalledTimes(1);
        expect(spyOnServiceInsert).toBeCalledWith(params);
      });
    });
  });
});
