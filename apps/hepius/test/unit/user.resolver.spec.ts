import {
  ClientCategory,
  IUpdateClientSettings,
  InnerQueueTypes,
  QueueType,
  mockLogger,
  mockProcessWarnings,
} from '@argus/pandora';
import { EventEmitter2 } from '@nestjs/event-emitter';
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
import {
  GetSlotsParams,
  UserController,
  UserModule,
  UserResolver,
  UserService,
} from '../../src/user';
import {
  dbDisconnect,
  defaultModules,
  generateCreateUserParams,
  generateGetSlotsParams,
  generateId,
  generateUpdateUserParams,
  mockGenerateUser,
} from '../index';
import { CognitoService } from '../../src/providers';
import { v4 } from 'uuid';

describe('UserResolver', () => {
  let module: TestingModule;
  let resolver: UserResolver;
  let controller: UserController;
  let service: UserService;
  let cognitoService: CognitoService;
  let eventEmitter: EventEmitter2;
  let spyOnEventEmitter;

  beforeAll(async () => {
    mockProcessWarnings(); // to hide pino prettyPrint warning
    module = await Test.createTestingModule({
      imports: defaultModules().concat(UserModule),
    }).compile();

    resolver = module.get<UserResolver>(UserResolver);
    controller = module.get<UserController>(UserController);
    service = module.get<UserService>(UserService);
    cognitoService = module.get<CognitoService>(CognitoService);
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
    let spyOnServiceUpdateAuthId;
    let spyOnServiceDelete;
    let spyOnCognitoAddClient;

    beforeEach(() => {
      spyOnServiceInsert = jest.spyOn(service, 'insert');
      spyOnServiceUpdateAuthId = jest.spyOn(service, 'updateAuthId');
      spyOnServiceDelete = jest.spyOn(service, 'delete');
      spyOnCognitoAddClient = jest.spyOn(cognitoService, 'addClient');
    });

    afterEach(() => {
      spyOnServiceInsert.mockReset();
      spyOnServiceUpdateAuthId.mockReset();
      spyOnServiceDelete.mockReset();
      spyOnCognitoAddClient.mockReset();
      spyOnEventEmitter.mockReset();
    });

    test.each([
      [Object.values(UserRole)],
      [[UserRole.coach, UserRole.nurse]],
      [[UserRole.coach]],
      [[UserRole.nurse]],
      [[UserRole.admin]],
    ])('should successfully create a user with role: %p', async (roles) => {
      const user = mockGenerateUser();
      const authId = v4();
      spyOnServiceInsert.mockImplementationOnce(async () => user);
      spyOnCognitoAddClient.mockResolvedValueOnce(authId);
      spyOnServiceUpdateAuthId.mockResolvedValueOnce({ ...user, authId });

      const params = generateCreateUserParams({ roles });
      await resolver.createUser(params);

      expect(spyOnServiceInsert).toBeCalledTimes(1);
      expect(spyOnServiceInsert).toBeCalledWith(params);
    });

    it(`should call events ${EventType.onNewUser} and ${EventType.notifyQueue}`, async () => {
      const params = generateCreateUserParams();
      const id = generateId();
      const user = { id, ...params };
      const authId = v4();
      spyOnServiceInsert.mockImplementationOnce(async () => user);
      spyOnCognitoAddClient.mockResolvedValueOnce(authId);
      spyOnServiceUpdateAuthId.mockResolvedValueOnce({ ...user, authId });

      await resolver.createUser(params);

      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const eventParams: IEventOnNewUser = { user: { ...user, authId } };
      /* eslint-enable */
      expect(spyOnEventEmitter).toHaveBeenNthCalledWith(1, EventType.onNewUser, eventParams);

      const updateClientSettings: IUpdateClientSettings = {
        type: InnerQueueTypes.updateClientSettings,
        id,
        clientCategory: ClientCategory.user,
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

    it('should erase created user if cognito fails to add a user', async () => {
      const user = mockGenerateUser();
      spyOnServiceInsert.mockImplementationOnce(async () => user);
      spyOnCognitoAddClient.mockRejectedValue({ message: 'failed to create a user' });
      spyOnServiceDelete.mockResolvedValueOnce(undefined);

      const params = generateCreateUserParams();
      await expect(resolver.createUser(params)).rejects.toThrow(
        Errors.get(ErrorType.userFailedToCreateOnExternalProvider),
      );

      expect(spyOnServiceInsert).toBeCalledTimes(1);
      expect(spyOnServiceInsert).toBeCalledWith(params);
      expect(spyOnCognitoAddClient).toBeCalled();
      expect(spyOnServiceDelete).toBeCalledWith(user.id);
    });
  });

  describe('updateUser', () => {
    let spyOnServiceUpdate;
    beforeEach(() => {
      spyOnServiceUpdate = jest.spyOn(service, 'update');
    });

    afterEach(() => {
      spyOnServiceUpdate.mockReset();
      spyOnEventEmitter.mockReset();
    });

    test.each([
      [Object.values(UserRole)],
      [[UserRole.coach, UserRole.nurse]],
      [[UserRole.coach]],
      [[UserRole.nurse]],
      [[UserRole.admin]],
    ])('should successfully update a user with role: %p', async (roles) => {
      spyOnServiceUpdate.mockImplementationOnce(async () => mockGenerateUser());

      const params = generateUpdateUserParams({ roles });
      await resolver.updateUser(params);

      expect(spyOnServiceUpdate).toBeCalledTimes(1);
      expect(spyOnServiceUpdate).toBeCalledWith(params);
    });

    it(`should call events ${EventType.onUpdatedUser} and ${EventType.notifyQueue}`, async () => {
      const user = generateUpdateUserParams();
      spyOnServiceUpdate.mockImplementationOnce(async () => user);
      await resolver.updateUser(user);

      const updateClientSettings: IUpdateClientSettings = {
        type: InnerQueueTypes.updateClientSettings,
        id: user.id,
        clientCategory: ClientCategory.user,
        firstName: user.firstName,
        lastName: user.lastName,
        avatar: user.avatar,
      };
      const eventSettingsParams: IEventNotifyQueue = {
        type: QueueType.notifications,
        message: JSON.stringify(updateClientSettings),
      };

      expect(spyOnEventEmitter).toHaveBeenNthCalledWith(
        1,
        EventType.notifyQueue,
        eventSettingsParams,
      );

      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const eventParams: IEventOnNewUser = { user };
      expect(spyOnEventEmitter).toHaveBeenNthCalledWith(2, EventType.onUpdatedUser, eventParams);
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

  describe('disableUser', () => {
    let spyOnServiceGet;
    beforeEach(() => {
      spyOnServiceGet = jest.spyOn(service, 'get');
    });

    afterEach(() => {
      spyOnServiceGet.mockReset();
    });

    it('should throw error on invalid user', async () => {
      spyOnServiceGet.mockResolvedValue(undefined);
      await expect(resolver.disableUser(generateId())).rejects.toThrow(
        Errors.get(ErrorType.userNotFound),
      );
    });

    it('should disable an existing user', async () => {
      const spyOnCognitoServiceDisableClient = jest.spyOn(cognitoService, 'disableClient');
      const userParams = mockGenerateUser();
      spyOnServiceGet.mockResolvedValue(userParams);
      spyOnCognitoServiceDisableClient.mockResolvedValue(true);

      const result = await resolver.disableUser(userParams.id);

      expect(result).toBeTruthy();
      expect(spyOnCognitoServiceDisableClient).toBeCalledWith(userParams.firstName.toLowerCase());

      spyOnCognitoServiceDisableClient.mockReset();
    });
  });

  describe('enableUser', () => {
    let spyOnServiceGet;
    beforeEach(() => {
      spyOnServiceGet = jest.spyOn(service, 'get');
    });

    afterEach(() => {
      spyOnServiceGet.mockReset();
    });

    it('should throw error on invalid user', async () => {
      spyOnServiceGet.mockResolvedValue(undefined);
      await expect(resolver.enableUser(generateId())).rejects.toThrow(
        Errors.get(ErrorType.userNotFound),
      );
    });

    it('should enable an existing user', async () => {
      const spyOnCognitoServiceEnableClient = jest.spyOn(cognitoService, 'enableClient');
      const userParams = mockGenerateUser();
      spyOnServiceGet.mockResolvedValue(userParams);
      spyOnCognitoServiceEnableClient.mockResolvedValue(true);

      const result = await resolver.enableUser(userParams.id);

      expect(result).toBeTruthy();
      expect(spyOnCognitoServiceEnableClient).toBeCalledWith(userParams.firstName.toLowerCase());

      spyOnCognitoServiceEnableClient.mockReset();
    });
  });
});
