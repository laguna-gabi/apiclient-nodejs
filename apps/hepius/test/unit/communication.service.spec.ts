import { Platform, mockLogger, mockProcessWarnings } from '@argus/pandora';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { date, internet } from 'faker';
import { Model, Types, model } from 'mongoose';
import { v4 } from 'uuid';
import {
  checkDelete,
  dbConnect,
  dbDisconnect,
  defaultModules,
  generateCommunication,
  generateId,
  generateUniqueUrl,
  mockGenerateMember,
  mockGenerateUser,
  mockProviders,
} from '..';
import {
  ErrorType,
  Errors,
  EventType,
  IEventDeleteMember,
  IEventOnNewMemberCommunication,
  IEventOnUpdateUserConfig,
  LoggerService,
  UpdatedAppointmentAction,
  UserRole,
} from '../../src/common';
import {
  Communication,
  CommunicationDocument,
  CommunicationDto,
  CommunicationModule,
  CommunicationService,
} from '../../src/communication';
import { ServiceModule } from '../../src/services';
import { AppointmentStatus } from '@argus/hepiusClient';

describe('CommunicationService', () => {
  let module: TestingModule;
  let service: CommunicationService;
  let sendBirdMock;
  let eventEmitter: EventEmitter2;
  let spyOnEventEmitter;
  let communicationModel: Model<CommunicationDocument>;

  beforeAll(async () => {
    mockProcessWarnings(); // to hide pino prettyPrint warning
    module = await Test.createTestingModule({
      imports: defaultModules().concat(CommunicationModule, ServiceModule),
    }).compile();

    service = module.get<CommunicationService>(CommunicationService);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
    spyOnEventEmitter = jest.spyOn(eventEmitter, 'emit');
    mockLogger(module.get<LoggerService>(LoggerService));

    communicationModel = model<CommunicationDocument>(Communication.name, CommunicationDto);

    sendBirdMock = mockProviders(module).sendBird;

    await dbConnect();
  });

  afterAll(async () => {
    await module.close();
    await dbDisconnect();

    sendBirdMock.spyOnSendBirdCreateUser.mockReset();
    sendBirdMock.spyOnSendBirdCreateGroupChannel.mockReset();
    sendBirdMock.spyOnSendBirdFreeze.mockReset();
    sendBirdMock.spyOnSendBirdDeleteGroupChannel.mockReset();
    sendBirdMock.spyOnSendBirdDeleteUser.mockReset();
    sendBirdMock.spyOnSendBirdUpdateGroupChannelMetadata.mockReset();
    sendBirdMock.spyOnSendBirdLeave.mockReset();
    sendBirdMock.spyOnSendBirdInvite.mockReset();
    sendBirdMock.spyOnSendBirdUpdateChannelName.mockReset();
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

      const eventParams: IEventOnUpdateUserConfig = {
        userId: user.id,
        accessToken: expect.any(String),
      };
      expect(spyOnEventEmitter).toBeCalledWith(EventType.onUpdatedUserConfig, eventParams);

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

      const eventParams: IEventOnNewMemberCommunication = {
        memberId: member.id,
        accessToken: expect.any(String),
      };
      expect(spyOnEventEmitter).toBeCalledWith(EventType.onNewMemberCommunication, eventParams);

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
      const sendBirdChannelUrl = internet.url();
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
          start: date.future(),
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
      const sendBirdChannelUrl = internet.url();
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

    it('should update a non existing user-member communication', async () => {
      const { params, communication } = await generateInviteScenario(true);

      expect(sendBirdMock.spyOnSendBirdUpdateGroupChannelMetadata).toBeCalledWith(
        communication.sendBirdChannelUrl,
        params.key,
        params.value,
      );
      expect(sendBirdMock.spyOnSendBirdInvite).toBeCalledWith(
        communication.sendBirdChannelUrl,
        params.userId,
      );

      sendBirdMock.spyOnSendBirdInvite.mockReset();
    });

    it('should not update a non existing user-member communication on failed invite', async () => {
      const { params, communication } = await generateInviteScenario(false);
      expect(sendBirdMock.spyOnSendBirdUpdateGroupChannelMetadata).not.toBeCalled();
      expect(sendBirdMock.spyOnSendBirdInvite).toBeCalledWith(
        communication.sendBirdChannelUrl,
        params.userId,
      );

      sendBirdMock.spyOnSendBirdInvite.mockReset();
    });

    async function generateInviteScenario(invite: boolean) {
      const member = mockGenerateMember();
      const user = mockGenerateUser();
      const communication = {
        memberId: new Types.ObjectId(member.id),
        userId: user.id,
        sendBirdChannelUrl: generateUniqueUrl(),
      };
      await communicationModel.create(communication);

      const mockServiceGet = jest.spyOn(service, 'get');
      mockServiceGet.mockImplementationOnce(async () => undefined);

      const params = {
        memberId: communication.memberId.toString(),
        userId: generateId(),
        key: generateId(),
        value: { status: AppointmentStatus.scheduled, start: date.future() },
        updatedAppointmentAction: UpdatedAppointmentAction.edit,
      };
      sendBirdMock.spyOnSendBirdInvite.mockReturnValue(
        invite ? [communication.userId, params.userId] : undefined,
      );

      await service.onUpdatedAppointment(params);

      return { params, communication };
    }
  });

  describe('updateUserInCommunication', () => {
    let mockServiceGet;

    beforeEach(() => {
      mockServiceGet = jest.spyOn(service, 'get');
    });

    afterEach(() => {
      mockServiceGet.mockReset();
    });

    afterEach(() => {
      sendBirdMock.spyOnSendBirdLeave.mockReset();
      sendBirdMock.spyOnSendBirdInvite.mockReset();
      sendBirdMock.spyOnSendBirdUpdateChannelName.mockReset();
    });

    it('should replace user in communication', async () => {
      const oldUserId = generateId();
      const newUser = mockGenerateUser();
      const member = mockGenerateMember();
      const sendBirdChannelUrl = internet.url();

      const params = {
        oldUserId,
        newUser,
        member,
        platform: Platform.android,
      };

      mockServiceGet.mockImplementationOnce(async () => ({
        memberId: member.id,
        userId: newUser.id,
        sendBirdChannelUrl,
      }));

      await service.updateUserInCommunication(params);

      expect(sendBirdMock.spyOnSendBirdLeave).toBeCalledWith(sendBirdChannelUrl, oldUserId);
      expect(sendBirdMock.spyOnSendBirdInvite).toBeCalledWith(sendBirdChannelUrl, newUser.id);
      expect(sendBirdMock.spyOnSendBirdUpdateChannelName).toBeCalledWith(
        sendBirdChannelUrl,
        newUser.firstName,
        newUser.avatar,
      );
    });

    it('should create new communication if old communication doesnt exist', async () => {
      const oldUserId = generateId();
      const newUser = mockGenerateUser();
      const member = mockGenerateMember();
      const platform = Platform.android;
      const spyOnServicesConnectMemberToUser = jest.spyOn(service, 'connectMemberToUser');

      const params = {
        oldUserId,
        newUser,
        member,
        platform,
      };
      mockServiceGet.mockImplementationOnce(async () => undefined);
      await service.updateUserInCommunication(params);
      expect(spyOnServicesConnectMemberToUser).toBeCalledWith(member, newUser, platform);
    });
  });

  describe('deleteMemberCommunication', () => {
    let mockServiceGetMemberUserCommunication;

    beforeEach(() => {
      mockServiceGetMemberUserCommunication = jest.spyOn(service, 'getMemberUserCommunication');
    });

    afterEach(() => {
      mockServiceGetMemberUserCommunication.mockReset();
      sendBirdMock.spyOnSendBirdDeleteGroupChannel.mockReset();
      sendBirdMock.spyOnSendBirdDeleteUser.mockReset();
      sendBirdMock.spyOnSendBirdFreeze.mockReset();
    });

    test.each([true, false])('should delete member communications', async (hard) => {
      const member = mockGenerateMember();
      const user = mockGenerateUser();
      const user2 = mockGenerateUser();
      const sendBirdChannelUrl = generateUniqueUrl();
      const deletedBy = generateId();
      const communication = generateCommunication({
        memberId: new Types.ObjectId(member.id),
        userId: new Types.ObjectId(user.id),
        sendBirdChannelUrl,
      });
      const communication2 = generateCommunication({
        memberId: new Types.ObjectId(member.id),
        userId: new Types.ObjectId(user2.id),
        sendBirdChannelUrl,
      });
      await communicationModel.create(communication);
      await communicationModel.create(communication2);

      const params: IEventDeleteMember = {
        memberId: member.id,
        deletedBy,
        hard,
      };
      await service.deleteMemberCommunication(params);

      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const deletedResult = await communicationModel.findWithDeleted({
        memberId: new Types.ObjectId(member.id),
      });

      if (hard) {
        expect(deletedResult).toEqual([]);
        expect(sendBirdMock.spyOnSendBirdDeleteGroupChannel).toBeCalledWith(
          communication.sendBirdChannelUrl,
        );
        expect(sendBirdMock.spyOnSendBirdDeleteUser).toBeCalledWith(member.id);
      } else {
        expect(deletedResult.length).toEqual(2);
        await checkDelete(deletedResult, { memberId: new Types.ObjectId(member.id) }, deletedBy);
        expect(sendBirdMock.spyOnSendBirdFreeze).toBeCalledWith(sendBirdChannelUrl, true);
      }
    });

    it('should be able to hard delete after soft delete', async () => {
      const member = mockGenerateMember();
      const user = mockGenerateUser();
      const sendBirdChannelUrl = generateUniqueUrl();
      const deletedBy = generateId();
      const communication = generateCommunication({
        memberId: new Types.ObjectId(member.id),
        userId: new Types.ObjectId(user.id),
        sendBirdChannelUrl,
      });
      await communicationModel.create(communication);

      const params: IEventDeleteMember = {
        memberId: member.id,
        deletedBy,
        hard: false,
      };
      await service.deleteMemberCommunication(params);
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const deletedResult = await communicationModel.findWithDeleted({
        memberId: new Types.ObjectId(member.id),
      });

      expect(deletedResult.length).toEqual(1);
      await checkDelete(deletedResult, { memberId: new Types.ObjectId(member.id) }, deletedBy);
      expect(sendBirdMock.spyOnSendBirdFreeze).toBeCalledWith(sendBirdChannelUrl, true);

      await service.deleteMemberCommunication({ ...params, hard: true });
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const deletedResultHard = await communicationModel.findWithDeleted({
        memberId: new Types.ObjectId(member.id),
      });
      expect(deletedResultHard).toEqual([]);
      expect(sendBirdMock.spyOnSendBirdDeleteGroupChannel).toBeCalledWith(
        communication.sendBirdChannelUrl,
      );
      expect(sendBirdMock.spyOnSendBirdDeleteUser).toBeCalledWith(member.id);
    });
  });

  describe('getParticipantUnreadMessagesCount', () => {
    it('should fail to to get member unread messages since member does not exists', async () => {
      await expect(service.getParticipantUnreadMessagesCount(generateId())).rejects.toThrow(
        Errors.get(ErrorType.communicationMemberUserNotFound),
      );
    });
  });
});
