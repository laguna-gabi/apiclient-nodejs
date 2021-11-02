import { EventEmitter2, EventEmitterModule } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import * as config from 'config';
import * as faker from 'faker';
import { v4 } from 'uuid';
import { EventType, Platform, UpdatedAppointmentAction } from '../../src/common';
import {
  CommunicationModule,
  CommunicationResolver,
  CommunicationService,
} from '../../src/communication';
import { DbModule } from '../../src/db/db.module';
import {
  dbDisconnect,
  generateGetCommunicationParams,
  generateId,
  generateUniqueUrl,
  mockGenerateMember,
  mockGenerateUser,
} from '../index';

describe('CommunicationResolver', () => {
  let module: TestingModule;
  let resolver: CommunicationResolver;
  let service: CommunicationService;
  let eventEmitter: EventEmitter2;
  let spyOnEventEmitter;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [DbModule, CommunicationModule, EventEmitterModule.forRoot()],
    }).compile();

    resolver = module.get<CommunicationResolver>(CommunicationResolver);
    service = module.get<CommunicationService>(CommunicationService);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
    spyOnEventEmitter = jest.spyOn(eventEmitter, 'emit');
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
      const memberId = generateId();

      const params = {
        oldUserId,
        newUser,
        memberId,
      };

      await resolver.updateUserInCommunication(params);
      expect(spyOnServiceUpdateUserInCommunication).toBeCalledWith(params);
      expect(spyOnEventEmitter).toBeCalledWith(EventType.updateUserInAppointments, {
        oldUserId,
        newUserId: newUser.id,
        memberId,
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
});
