import { EventEmitter2, EventEmitterModule } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import * as faker from 'faker';
import { v4 } from 'uuid';
import { AppointmentStatus } from '../../src/appointment';
import {
  EventType,
  IEventUpdateMemberConfig,
  IEventUpdateUserConfig,
  Platform,
  UpdatedAppointmentAction,
} from '../../src/common';
import { CommunicationModule, CommunicationService } from '../../src/communication';
import { DbModule } from '../../src/db/db.module';
import { UserRole } from '../../src/user';
import {
  dbConnect,
  dbDisconnect,
  generateId,
  generateUniqueUrl,
  mockGenerateMember,
  mockGenerateUser,
  mockProviders,
} from '../index';

describe('CommunicationService', () => {
  let module: TestingModule;
  let service: CommunicationService;
  let sendBirdMock;
  let eventEmitter: EventEmitter2;
  let spyOnEventEmitter;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [DbModule, CommunicationModule, EventEmitterModule.forRoot()],
    }).compile();

    service = module.get<CommunicationService>(CommunicationService);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
    spyOnEventEmitter = jest.spyOn(eventEmitter, 'emit');

    sendBirdMock = mockProviders(module).sendBird;

    await dbConnect();
  });

  afterAll(async () => {
    await module.close();
    await dbDisconnect();

    sendBirdMock.spyOnSendBirdCreateUser.mockReset();
    sendBirdMock.spyOnSendBirdCreateGroupChannel.mockReset();
    sendBirdMock.spyOnSendBirdFreeze.mockReset();
    sendBirdMock.spyOnSendBirdUpdateGroupChannelMetadata.mockReset();
    sendBirdMock.spyOnSendBirdDeleteGroupChannelMetadata.mockReset();
  });

  describe('createUser', () => {
    it('should call createUser with user params', async () => {
      const user = mockGenerateUser();
      await service.createUser(user);
      expect(sendBirdMock.spyOnSendBirdCreateUser).toBeCalledWith({
        user_id: user.id,
        nickname: `${user.firstName} ${user.lastName}`,
        profile_url: user.avatar,
        issue_access_token: true,
        metadata: { role: UserRole.coach.toLowerCase() },
      });
    });

    it('should send updateUserConfig event', async () => {
      const user = mockGenerateUser();
      await service.createUser(user);

      const eventParams: IEventUpdateUserConfig = {
        userId: user.id,
        accessToken: expect.any(String),
      };
      expect(spyOnEventEmitter).toBeCalledWith(EventType.updateUserConfig, eventParams);

      spyOnEventEmitter.mockReset();
    });
  });

  describe('createMember', () => {
    it('should call createMember with member params', async () => {
      const member = mockGenerateMember();
      await service.createMember(member);
      expect(sendBirdMock.spyOnSendBirdCreateUser).toBeCalledWith({
        user_id: member.id,
        nickname: `${member.firstName} ${member.lastName}`,
        profile_url: '',
        issue_access_token: true,
        metadata: {},
      });
    });

    it('should send updateMemberConfig event', async () => {
      const member = mockGenerateMember();
      await service.createMember(member);

      const eventParams: IEventUpdateMemberConfig = {
        memberId: member.id,
        accessToken: expect.any(String),
      };
      expect(spyOnEventEmitter).toBeCalledWith(EventType.updateMemberConfig, eventParams);

      spyOnEventEmitter.mockReset();
    });
  });

  describe('connectMemberToUser', () => {
    it('should call connectMemberToUser with member params', async () => {
      const member = mockGenerateMember();
      const user = mockGenerateUser();
      const mockServiceGet = jest.spyOn(service, 'get');

      mockServiceGet.mockImplementationOnce(async () => ({
        memberId: member.id,
        userId: user.id,
        sendBirdChannelUrl: generateUniqueUrl(),
      }));

      await service.connectMemberToUser(member, user, Platform.android);

      expect(sendBirdMock.spyOnSendBirdCreateGroupChannel).toBeCalledWith({
        name: user.firstName,
        channel_url: expect.any(String),
        cover_url: user.avatar,
        inviter_id: user.id,
        user_ids: [member.id, user.id],
      });

      expect(sendBirdMock.spyOnSendBirdFreeze).toBeCalledWith(expect.any(String), false);
      mockServiceGet.mockReset();
    });
  });

  describe('get', () => {
    it('should return null for not existing userId and memberId', async () => {
      const result = await service.get({
        memberId: generateId(),
        userId: v4(),
      });
      expect(result).toBeUndefined();
    });
  });

  describe('onUpdateMemberPlatform', () => {
    it('should update member platform and freeze/unfreeze accordingly', async () => {
      const mockServiceGet = jest.spyOn(service, 'get');

      const data = {
        memberId: generateId(),
        userId: v4(),
        sendBirdChannelUrl: generateUniqueUrl(),
      };
      mockServiceGet.mockImplementationOnce(async () => data);

      await service.onUpdateMemberPlatform({
        memberId: data.memberId,
        userId: data.userId,
        platform: Platform.android,
      });

      expect(sendBirdMock.spyOnSendBirdFreeze).toBeCalledWith(expect.any(String), false);
    });
  });

  describe('onUpdatedAppointment', () => {
    afterEach(() => {
      sendBirdMock.spyOnSendBirdUpdateGroupChannelMetadata.mockReset();
    });

    it('should handle updated appointment according to the action - edit', async () => {
      const member = mockGenerateMember();
      const user = mockGenerateUser();
      const sendBirdChannelUrl = faker.internet.url();
      const mockServiceGet = jest.spyOn(service, 'get');
      mockServiceGet.mockImplementationOnce(async () => ({
        memberId: member.id,
        userId: user.id,
        sendBirdChannelUrl,
      }));

      const params = {
        memberId: member.id,
        userId: user.id,
        key: generateId(),
        value: {
          status: AppointmentStatus.scheduled,
          start: faker.date.future(),
        },
        updatedAppointmentAction: UpdatedAppointmentAction.edit,
      };

      await service.onUpdatedAppointment(params);

      expect(sendBirdMock.spyOnSendBirdUpdateGroupChannelMetadata).toBeCalledWith(
        sendBirdChannelUrl,
        params.key,
        params.value,
      );
    });

    it('should handle updated appointment according to the action - delete', async () => {
      const member = mockGenerateMember();
      const user = mockGenerateUser();
      const sendBirdChannelUrl = faker.internet.url();
      const mockServiceGet = jest.spyOn(service, 'get');
      mockServiceGet.mockImplementationOnce(async () => ({
        memberId: member.id,
        userId: user.id,
        sendBirdChannelUrl,
      }));

      const params = {
        memberId: member.id,
        userId: user.id,
        key: generateId(),
        updatedAppointmentAction: UpdatedAppointmentAction.delete,
      };

      await service.onUpdatedAppointment(params);

      expect(sendBirdMock.spyOnSendBirdDeleteGroupChannelMetadata).toBeCalledWith(
        sendBirdChannelUrl,
        params.key,
      );
    });

    it('should not update since no user-member communication was found', async () => {
      const mockServiceGet = jest.spyOn(service, 'get');
      mockServiceGet.mockImplementationOnce(async () => undefined);

      const params = {
        memberId: generateId(),
        userId: v4(),
        key: generateId(),
        value: {
          status: AppointmentStatus.scheduled,
          start: faker.date.future(),
        },
        updatedAppointmentAction: UpdatedAppointmentAction.edit,
      };

      await service.onUpdatedAppointment(params);

      expect(sendBirdMock.spyOnSendBirdUpdateGroupChannelMetadata).not.toBeCalled();
    });
  });
});
