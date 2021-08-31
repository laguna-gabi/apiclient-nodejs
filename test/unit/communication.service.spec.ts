import { Test, TestingModule } from '@nestjs/testing';
import { DbModule } from '../../src/db/db.module';
import { Model, model } from 'mongoose';
import {
  dbConnect,
  dbDisconnect,
  generateId,
  mockGenerateMember,
  mockGenerateUser,
  mockProviders,
} from '../index';
import {
  Communication,
  CommunicationDto,
  CommunicationModule,
  CommunicationService,
} from '../../src/communication';
import { UserRole } from '../../src/user';
import { v4 } from 'uuid';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { Platform } from '../../src/common';

describe('CommunicationService', () => {
  let module: TestingModule;
  let service: CommunicationService;
  let communicationModel: Model<typeof CommunicationDto>;
  let sendBirdMock;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [DbModule, CommunicationModule, EventEmitterModule.forRoot()],
    }).compile();

    service = module.get<CommunicationService>(CommunicationService);

    sendBirdMock = mockProviders(module).sendBird;

    communicationModel = model(Communication.name, CommunicationDto);

    await dbConnect();
  });

  afterAll(async () => {
    await module.close();
    await dbDisconnect();

    sendBirdMock.spyOnSendBirdCreateUser.mockReset();
    sendBirdMock.spyOnSendBirdCreateGroupChannel.mockReset();
    sendBirdMock.spyOnSendBirdFreeze.mockReset();
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
  });

  describe('connectMemberToUser', () => {
    it('should call connectMemberToUser with member params', async () => {
      const member = mockGenerateMember();
      const user = mockGenerateUser();
      const mockServiceGet = jest.spyOn(service, 'get');

      mockServiceGet.mockImplementationOnce(async () => ({
        memberId: member.id,
        userId: user.id,
        sendbirdChannelUrl: 'test123',
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
        sendbirdChannelUrl: 'test123',
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
});
