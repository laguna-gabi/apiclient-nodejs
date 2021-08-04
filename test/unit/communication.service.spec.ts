import { Test, TestingModule } from '@nestjs/testing';
import { DbModule } from '../../src/db/db.module';
import { Model, model, Types } from 'mongoose';
import {
  dbConnect,
  dbDisconnect,
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

describe('CommunicationService', () => {
  let module: TestingModule;
  let service: CommunicationService;
  let communicationModel: Model<typeof CommunicationDto>;
  let sendBirdMock;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [DbModule, CommunicationModule],
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
        metadata: { roles: user.roles },
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
        memberId: new Types.ObjectId(member.id),
        userId: new Types.ObjectId(user.id),
      });

      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            memberId: new Types.ObjectId(member.id),
            userId: new Types.ObjectId(user.id),
            sendbirdChannelUrl: expect.any(String),
          }),
        ]),
      );
    });
  });

  describe('get', () => {
    it('should fetch communication object from userId and memberId', async () => {
      const member = mockGenerateMember();
      await service.createMember(member);
      const user = mockGenerateUser();
      await service.createUser(user);
      await service.connectMemberToUser(member, user);

      const result = await service.get({ memberId: member.id, userId: user.id });
      expect(result.memberId.toString()).toEqual(member.id);
      expect(result.userId.toString()).toEqual(user.id);
      expect(result.sendbirdChannelUrl).toEqual(expect.any(String));
    });

    it('should return null for not existing userId and memberId', async () => {
      const result = await service.get({
        memberId: new Types.ObjectId().toString(),
        userId: new Types.ObjectId().toString(),
      });
      expect(result).toBeNull();
    });
  });
});
