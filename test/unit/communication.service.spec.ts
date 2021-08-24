import { Test, TestingModule } from '@nestjs/testing';
import { DbModule } from '../../src/db/db.module';
import { Model, model } from 'mongoose';
import {
  dbConnect,
  dbDisconnect,
  generateId,
  generateObjectId,
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
    it('should call createUser with member params', async () => {
      const member = mockGenerateMember();
      const user = mockGenerateUser();
      await service.connectMemberToUser(member, user);

      expect(sendBirdMock.spyOnSendBirdCreateGroupChannel).toBeCalledWith({
        name: user.firstName,
        channel_url: expect.any(String),
        cover_url: user.avatar,
        inviter_id: user.id,
        user_ids: [member.id, user.id],
      });

      const result = await communicationModel.find({
        memberId: generateObjectId(member.id),
        userId: user.id,
      });

      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            memberId: generateObjectId(member.id),
            userId: user.id,
            sendbirdChannelUrl: expect.any(String),
          }),
        ]),
      );
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
});
