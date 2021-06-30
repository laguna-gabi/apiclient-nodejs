import { UserResolver } from '../../src/user/user.resolver';
import { UserService } from '../../src/user/user.service';
import { Test, TestingModule } from '@nestjs/testing';
import { UserModule } from '../../src/user/user.module';
import { mockGenerateUser, generateCreateUserParams } from '../../test';
import { DbModule } from '../../src/db/db.module';
import { Errors } from '../../src/common';
import { ObjectID } from 'bson';

describe('UserResolver', () => {
  let resolver: UserResolver;
  let service: UserService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [DbModule, UserModule],
    }).compile();

    resolver = module.get<UserResolver>(UserResolver);
    service = module.get<UserService>(UserService);
  });

  describe('createUser', () => {
    let spyOnServiceInsert;
    beforeEach(() => {
      spyOnServiceInsert = jest.spyOn(service, 'insert');
    });

    afterEach(() => {
      spyOnServiceInsert.mockReset();
    });

    it('should create a user', async () => {
      spyOnServiceInsert.mockImplementationOnce(async () => mockGenerateUser());

      const params = generateCreateUserParams();
      await resolver.createUser(params);

      expect(spyOnServiceInsert).toBeCalledTimes(1);
      expect(spyOnServiceInsert).toBeCalledWith(params);
    });

    it('should fail to create a user due to invalid user role', async () => {
      //@ts-ignore
      const params = generateCreateUserParams('invalid role');

      await expect(resolver.createUser(params)).rejects.toThrow(
        `${Errors.user.create.title} : ${Errors.user.create.reasons.role}`,
      );

      expect(spyOnServiceInsert).not.toBeCalled();
    });
  });

  describe('getUser', () => {
    let spyOnServiceGet;
    beforeEach(() => {
      spyOnServiceGet = jest.spyOn(service, 'get');
    });

    afterEach(() => {
      spyOnServiceGet.mockReset();
    });

    it('should get a user for a given id', async () => {
      const user = mockGenerateUser();
      spyOnServiceGet.mockImplementationOnce(async () => user);

      const result = await resolver.getUser(user.id);

      expect(result).toEqual(user);
    });

    it('should fetch empty on a non existing user', async () => {
      spyOnServiceGet.mockImplementationOnce(async () => null);

      const id = new ObjectID();
      const result = await resolver.getUser(id.toString());

      expect(result).toBeNull();
    });
  });
});
