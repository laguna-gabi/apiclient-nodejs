import { EventEmitter2, EventEmitterModule } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import {
  ErrorType,
  Errors,
  EventType,
  IEventNotifyQueue,
  IEventOnNewUser,
  LoggerService,
  UserRole,
} from '../../src/common';
import { DbModule } from '../../src/db/db.module';
import {
  GetSlotsParams,
  UserController,
  UserModule,
  UserResolver,
  UserService,
} from '../../src/user';
import {
  dbDisconnect,
  generateCreateUserParams,
  generateGetSlotsParams,
  generateId,
  mockGenerateUser,
  mockLogger,
} from '../index';
import { IUpdateClientSettings, InnerQueueTypes, QueueType } from '@lagunahealth/pandora';

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
    mockLogger(module.get<LoggerService>(LoggerService));
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

    it(`should call events ${EventType.onNewUser} and ${EventType.notifyQueue}`, async () => {
      const params = generateCreateUserParams();
      const id = generateId();
      spyOnServiceInsert.mockImplementationOnce(async () => ({ ...params, id }));
      await resolver.createUser(params);

      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const eventParams: IEventOnNewUser = { user: { ...params, id } };
      /* eslint-enable */
      expect(spyOnEventEmitter).toHaveBeenNthCalledWith(1, EventType.onNewUser, eventParams);

      const updateClientSettings: IUpdateClientSettings = {
        type: InnerQueueTypes.updateClientSettings,
        id,
        phone: params.phone,
        firstName: params.firstName,
        lastName: params.lastName,
        avatar: params.avatar,
      };
      const eventSettingsParams: IEventNotifyQueue = {
        type: QueueType.notifications,
        message: JSON.stringify(updateClientSettings),
      };

      expect(spyOnEventEmitter).toHaveBeenNthCalledWith(
        2,
        EventType.notifyQueue,
        eventSettingsParams,
      );
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

    it('should fail to fetch user without userId in token', async () => {
      spyOnServiceGet.mockImplementationOnce(async () => null);
      await expect(resolver.getUser(undefined)).rejects.toThrow(Errors.get(ErrorType.userNotFound));
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
      const userId = generateId();

      spyOnServiceGetUserConfig.mockImplementationOnce(async () => userId);

      const result = await resolver.getUserConfig(userId);

      expect(spyOnServiceGetUserConfig).toBeCalledWith(userId);
      expect(result).toEqual(userId);
    });
  });
});
