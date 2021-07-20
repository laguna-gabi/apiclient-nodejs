import { Test, TestingModule } from '@nestjs/testing';
import { DbModule } from '../../src/db/db.module';
import { Model, model } from 'mongoose';
import { dbConnect, dbDisconnect, generateOrgParams } from '../index';
import { Errors, ErrorType } from '../../src/common';
import { Org, OrgDto, OrgModule, OrgService, OrgType } from '../../src/org';

describe('OrgService', () => {
  let module: TestingModule;
  let service: OrgService;
  let orgModel: Model<typeof OrgDto>;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [DbModule, OrgModule],
    }).compile();

    service = module.get<OrgService>(OrgService);

    orgModel = model(Org.name, OrgDto);

    await dbConnect();
  });

  afterAll(async () => {
    await module.close();
    await dbDisconnect();
  });

  describe('insert', () => {
    test.each([OrgType.hospital, OrgType.service])(
      'should successfully insert a user having types : %p',
      async (type) => {
        const user = generateOrgParams({ type });
        const { id } = await service.insert(user);

        const createdUser = await orgModel.findOne({ _id: id });
        expect(createdUser.toObject()).toEqual(expect.objectContaining(user));

        expect(id).not.toBeNull();
      },
    );

    it('should check that createdAt and updatedAt exists in the collection', async () => {
      const org = generateOrgParams();
      const { id } = await service.insert(org);

      const createdOrg = await orgModel.findById(id);
      expect(createdOrg.toObject()).toEqual(expect.objectContaining(org));
    });

    it('should fail to insert an already existing org', async () => {
      const org1 = generateOrgParams();
      await service.insert(org1);
      const org2 = generateOrgParams({ name: org1.name });

      await expect(service.insert(org2)).rejects.toThrow(Errors.get(ErrorType.orgAlreadyExists));
    });
  });
});
