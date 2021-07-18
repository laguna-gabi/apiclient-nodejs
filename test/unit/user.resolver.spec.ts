import { Test, TestingModule } from '@nestjs/testing';
import {
  dbDisconnect,
  generateCreateUserParams,
  mockGenerateUser,
} from '../../test';
import { DbModule } from '../../src/db/db.module';
import { Types } from 'mongoose';
import {
  UserModule,
  UserResolver,
  UserRole,
  UserService,
} from '../../src/user';
import { EventEmitterModule } from '@nestjs/event-emitter';

describe('UserResolver', () => {
  let module: TestingModule;
  let resolver: UserResolver;
  let service: UserService;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [DbModule, UserModule, EventEmitterModule.forRoot()],
    }).compile();

    resolver = module.get<UserResolver>(UserResolver);
    service = module.get<UserService>(UserService);
  });

  afterAll(async () => {
    await module.close();
    await dbDisconnect();
  });

  describe('createUser', () => {
    let spyOnServiceInsert;
    beforeEach(() => {
      spyOnServiceInsert = jest.spyOn(service, 'insert');
    });

    afterEach(() => {
      spyOnServiceInsert.mockReset();
    });

    test.each([
      [Object.values(UserRole)],
      [[UserRole.coach, UserRole.nurse]],
      [[UserRole.coach]],
      [[UserRole.nurse]],
      [[UserRole.admin]],
    ])('should successfully create a user with role: %p', async (roles) => {
      spyOnServiceInsert.mockImplementationOnce(async () => mockGenerateUser());

      const params = generateCreateUserParams({ roles });
      await resolver.createUser(params);

      expect(spyOnServiceInsert).toBeCalledTimes(1);
      expect(spyOnServiceInsert).toBeCalledWith(params);
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

      const id = new Types.ObjectId();
      const result = await resolver.getUser(id.toString());

      expect(result).toBeNull();
    });
  });
});
