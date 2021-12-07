import { Platform } from '@lagunahealth/pandora';
import { EventEmitter2, EventEmitterModule } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import * as config from 'config';
import * as faker from 'faker';
import { v4 } from 'uuid';
import {
  ErrorType,
  Errors,
  EventType,
  Logger,
  MemberRole,
  UpdatedAppointmentAction,
  UserRole,
} from '../../src/common';
import {
  CommunicationModule,
  CommunicationResolver,
  CommunicationService,
} from '../../src/communication';
import { DbModule } from '../../src/db/db.module';
import { UserService } from '../../src/user';
import {
  dbDisconnect,
  generateCommunication,
  generateGetCommunicationParams,
  generateId,
  generateUniqueUrl,
  mockGenerateMember,
  mockGenerateUser,
  mockLogger,
} from '../index';

describe('CommunicationResolver', () => {
  let module: TestingModule;
  let resolver: CommunicationResolver;
  let service: CommunicationService;
  let userService: UserService;
  let eventEmitter: EventEmitter2;
  let spyOnEventEmitter;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [DbModule, CommunicationModule, EventEmitterModule.forRoot()],
    }).compile();

    resolver = module.get<CommunicationResolver>(CommunicationResolver);
    service = module.get<CommunicationService>(CommunicationService);
    userService = module.get<UserService>(UserService);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
    spyOnEventEmitter = jest.spyOn(eventEmitter, 'emit');
    mockLogger(module.get<Logger>(Logger));
  });

  afterAll(async () => {
    await module.close();
    await dbDisconnect();
  });

  afterEach(() => {
    spyOnEventEmitter.mockReset();
  });

  describe('handleNewUser', () => {
    let spyOnServiceCreateUser;
    beforeEach(() => {
      spyOnServiceCreateUser = jest.spyOn(service, 'createUser');
    });

    afterEach(() => {
      spyOnServiceCreateUser.mockReset();
    });

    it('should successfully handle a new user', async () => {
      spyOnServiceCreateUser.mockImplementationOnce(() => undefined);

      const user = mockGenerateUser();
      await resolver.handleNewUser({ user });
      expect(spyOnServiceCreateUser).toBeCalledWith(user);
    });
  });

  describe('handleNewMember', () => {
    let spyOnServiceCreateMember;
    let spyOnServiceConnectMemberToUser;
    beforeEach(() => {
      spyOnServiceCreateMember = jest.spyOn(service, 'createMember');
      spyOnServiceConnectMemberToUser = jest.spyOn(service, 'connectMemberToUser');
    });

    afterEach(() => {
      spyOnServiceCreateMember.mockReset();
      spyOnServiceConnectMemberToUser.mockReset();
    });

    it('should successfully handle a new member', async () => {
      spyOnServiceCreateMember.mockImplementationOnce(() => true);
      spyOnServiceConnectMemberToUser.mockImplementation(() => true);

      const platform = Platform.android;
      const user = mockGenerateUser();
      const member = mockGenerateMember();
      await resolver.handleNewMember({ member, user, platform });

      expect(spyOnServiceCreateMember).toBeCalledWith(member);
      expect(spyOnServiceConnectMemberToUser).toBeCalledTimes(1);
      expect(spyOnServiceConnectMemberToUser).toBeCalledWith(member, user, platform);
    });
  });

  describe('handleUpdatedAppointment', () => {
    let spyOnServiceUpdatedAppointment;
    beforeEach(() => {
      spyOnServiceUpdatedAppointment = jest.spyOn(service, 'onUpdatedAppointment');
    });

    afterEach(() => {
      spyOnServiceUpdatedAppointment.mockReset();
    });

    it('should successfully handle an updated appointment', async () => {
      spyOnServiceUpdatedAppointment.mockImplementationOnce(() => undefined);

      const params = {
        memberId: generateId(),
        userId: v4(),
        key: faker.lorem.word(),
        updatedAppointmentAction: UpdatedAppointmentAction.delete,
      };
      await resolver.handleUpdatedAppointment(params);
      expect(spyOnServiceUpdatedAppointment).toBeCalledWith(params);
    });
  });

  describe('updateUserInCommunication', () => {
    let spyOnServiceUpdateUserInCommunication;

    beforeEach(() => {
      spyOnServiceUpdateUserInCommunication = jest.spyOn(service, 'updateUserInCommunication');
    });

    afterEach(() => {
      spyOnServiceUpdateUserInCommunication.mockReset();
    });

    it('should successfully replace user in communication', async () => {
      spyOnServiceUpdateUserInCommunication.mockImplementationOnce(() => undefined);
      const oldUserId = generateId();
      const newUser = mockGenerateUser();
      const member = mockGenerateMember();
      const platform = Platform.android;

      const params = {
        oldUserId,
        newUser,
        member,
        platform,
      };

      await resolver.updateUserInCommunication(params);
      expect(spyOnServiceUpdateUserInCommunication).toBeCalledWith(params);
      expect(spyOnEventEmitter).toBeCalledWith(EventType.onUpdatedUserCommunication, {
        oldUserId,
        newUserId: newUser.id,
        memberId: member.id,
      });
    });
  });

  describe('get', () => {
    let spyOnServiceGet;
    beforeEach(() => {
      spyOnServiceGet = jest.spyOn(service, 'get');
    });

    afterEach(() => {
      spyOnServiceGet.mockReset();
    });

    it('should successfully return a communication object', async () => {
      const payload = {
        userId: v4(),
        memberId: generateId(),
        sendBirdChannelUrl: generateUniqueUrl(),
        userToken: faker.datatype.uuid(),
        memberToken: faker.datatype.uuid(),
      };
      spyOnServiceGet.mockImplementationOnce(() => payload);

      const params = generateGetCommunicationParams();
      const result = await resolver.getCommunication(params);

      const link = (id, token) => {
        return `${config.get('hosts.chat')}/?uid=${id}&mid=${
          payload.sendBirdChannelUrl
        }&token=${token}`;
      };

      expect(result).toEqual({
        userId: payload.userId,
        memberId: payload.memberId,
        chat: {
          memberLink: link(payload.memberId, payload.memberToken),
          userLink: link(payload.userId, payload.userToken),
        },
      });

      expect(spyOnServiceGet).toBeCalledWith(params);
    });

    it('should return null on no communication of user and member', async () => {
      spyOnServiceGet.mockImplementationOnce(() => null);

      const params = generateGetCommunicationParams();
      const result = await resolver.getCommunication(params);

      expect(spyOnServiceGet).toBeCalledWith(params);
      expect(result).toBeNull();
    });
  });

  describe('twilio', () => {
    let spyOnServiceGetTwilioToken;
    beforeEach(() => {
      spyOnServiceGetTwilioToken = jest.spyOn(service, 'getTwilioAccessToken');
    });

    afterEach(() => {
      spyOnServiceGetTwilioToken.mockReset();
    });

    it('should return twilio token', () => {
      const token = v4();
      spyOnServiceGetTwilioToken.mockImplementationOnce(() => token);

      const result = resolver.getTwilioAccessToken();
      expect(result).toEqual(token);
    });
  });

  describe('getMemberCommunicationInfo', () => {
    let spyOnServiceGet; // get communication
    let spyOnUserServiceGet; // Get user
    const user = mockGenerateUser(); // mock user
    const communication = generateCommunication(); // mock communication

    beforeEach(() => {
      spyOnServiceGet = jest.spyOn(service, 'get');
      spyOnUserServiceGet = jest.spyOn(userService, 'get');
    });

    afterEach(() => {
      spyOnServiceGet.mockReset();
      spyOnUserServiceGet.mockReset();
    });

    it('should successfully return communication info', async () => {
      spyOnServiceGet.mockImplementationOnce(() => communication);
      spyOnUserServiceGet.mockImplementationOnce(() => user);

      const communicationInfo = await resolver.getMemberCommunicationInfo(
        [MemberRole.member],
        generateId(),
        generateId(),
      );

      expect(communicationInfo).toEqual({
        memberLink:
          `https://dev.chat.lagunahealth.com/?uid=${communication.memberId}` +
          `&mid=${communication.sendBirdChannelUrl}&token=undefined`,
        user: {
          avatar: user.avatar,
          firstName: user.firstName,
          id: `${user.id}`,
          lastName: user.lastName,
          roles: user.roles,
        },
      });
    });

    /* eslint-disable-next-line max-len */
    it('should throw error for a non-member user attempting to get communication info', async () => {
      spyOnServiceGet.mockImplementationOnce(() => communication);
      spyOnUserServiceGet.mockImplementationOnce(() => user);

      await expect(
        resolver.getMemberCommunicationInfo([UserRole.coach], generateId(), generateId()),
      ).rejects.toThrow(Errors.get(ErrorType.memberAllowedOnly));
    });

    it('should throw error if primary user is missing', async () => {
      spyOnServiceGet.mockImplementationOnce(() => communication);
      spyOnUserServiceGet.mockImplementationOnce(() => undefined);

      await expect(
        resolver.getMemberCommunicationInfo([MemberRole.member], generateId(), generateId()),
      ).rejects.toThrow(Errors.get(ErrorType.userNotFound));
    });

    it('should throw error if no communication between user and member', async () => {
      spyOnServiceGet.mockImplementationOnce(() => undefined);
      spyOnUserServiceGet.mockImplementationOnce(() => user);

      await expect(
        resolver.getMemberCommunicationInfo([MemberRole.member], generateId(), generateId()),
      ).rejects.toThrow(Errors.get(ErrorType.communicationMemberUserNotFound));
    });
  });
});
