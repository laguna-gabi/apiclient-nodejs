import { EventEmitter2, EventEmitterModule } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { v4 } from 'uuid';
import { EventType, IEventNewUser } from '../../src/common';
import { DbModule } from '../../src/db/db.module';
import {
  GetSlotsParams,
  UserController,
  UserModule,
  UserResolver,
  UserRole,
  UserService,
} from '../../src/user';
import {
  dbDisconnect,
  generateCreateUserParams,
  generateGetSlotsParams,
  mockGenerateUser,
} from '../index';

describe('UserResolver', () => {
  let module: TestingModule;
  let resolver: UserResolver;
  let controller: UserController;
  let service: UserService;
  let eventEmitter: EventEmitter2;
  let spyOnEventEmitter;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [DbModule, UserModule, EventEmitterModule.forRoot()],
    }).compile();

    resolver = module.get<UserResolver>(UserResolver);
    controller = module.get<UserController>(UserController);
    service = module.get<UserService>(UserService);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
    spyOnEventEmitter = jest.spyOn(eventEmitter, 'emit');
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
      spyOnEventEmitter.mockReset();
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

    it('should call event newUser', async () => {
      const params = generateCreateUserParams();
      spyOnServiceInsert.mockImplementationOnce(async () => params);
      await resolver.createUser(params);

      /* eslint-disable */
      // @ts-ignore
      const eventParams: IEventNewUser = { user: params };
      /* eslint-enable */
      expect(spyOnEventEmitter).toBeCalledWith(EventType.newUser, eventParams);
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

  describe('getUsers', () => {
    let spyOnServiceGetUsers;
    beforeEach(() => {
      spyOnServiceGetUsers = jest.spyOn(service, 'getUsers');
    });

    afterEach(() => {
      spyOnServiceGetUsers.mockReset();
    });

    it('should get users', async () => {
      const user1 = mockGenerateUser();
      const user2 = mockGenerateUser();
      spyOnServiceGetUsers.mockImplementationOnce(async () => [user1, user2]);

      const result = await resolver.getUsers();

      expect(result).toEqual([user1, user2]);
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

    it('should get free slots of a user given an Id', async () => {
      const getSlotsParams: GetSlotsParams = generateGetSlotsParams();
      delete getSlotsParams.notBefore;
      delete getSlotsParams.userId;

      spyOnServiceGetSlots.mockImplementationOnce(async () => getSlotsParams);

      const result = await controller.getUserSlots(getSlotsParams);

      expect(spyOnServiceGetSlots).toBeCalledWith(getSlotsParams);
      expect(result).toEqual(getSlotsParams);
    });
  });

  describe('getUserConfig', () => {
    let spyOnServiceGetUserConfig;
    beforeEach(() => {
      spyOnServiceGetUserConfig = jest.spyOn(service, 'getUserConfig');
    });

    afterEach(() => {
      spyOnServiceGetUserConfig.mockReset();
    });

    it('should fetch userConfig', async () => {
      const userId = v4();

      spyOnServiceGetUserConfig.mockImplementationOnce(async () => userId);

      const result = await resolver.getUserConfig(userId);

      expect(spyOnServiceGetUserConfig).toBeCalledWith(userId);
      expect(result).toEqual(userId);
    });
  });
});
