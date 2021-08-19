import { Test, TestingModule } from '@nestjs/testing';
import {
  dbDisconnect,
  generateCreateUserParams,
  generateGetSlotsParams,
  mockGenerateUser,
} from '../index';
import { DbModule } from '../../src/db/db.module';
import { UserModule, UserResolver, UserRole, UserService } from '../../src/user';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { v4 } from 'uuid';
import { GetSlotsParams } from '../../src/user/slot.dto';

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

      const result = await resolver.getUser(v4());

      expect(result).toBeNull();
    });
  });

  describe('getUserSlots', () => {
    let spyOnServiceGetSlots;
    beforeEach(() => {
      spyOnServiceGetSlots = jest.spyOn(service, 'getSlots');
    });

    afterEach(() => {
      spyOnServiceGetSlots.mockReset();
    });

    it('should get free slots of a user given an appointmentId', async () => {
      const getSlotsParams: GetSlotsParams = generateGetSlotsParams();

      spyOnServiceGetSlots.mockImplementationOnce(async () => getSlotsParams);

      const result = await resolver.getUserSlots(getSlotsParams);

      expect(spyOnServiceGetSlots).toBeCalledWith(getSlotsParams);
      expect(result).toEqual(getSlotsParams);
    });
  });
});
