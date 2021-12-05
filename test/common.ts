import { INestApplication } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { GraphQLModule } from '@nestjs/graphql';
import { ScheduleModule } from '@nestjs/schedule';
import { TestingModule } from '@nestjs/testing';
import * as config from 'config';
import { connect, disconnect } from 'mongoose';
import { v4 } from 'uuid';
import { MemberRole, RoleTypes, apiPrefix, webhooks } from '../src/common';
import { DbModule } from '../src/db/db.module';
import { Member, defaultMemberParams } from '../src/member';
import {
  CognitoService,
  FeatureFlagService,
  NotificationsService,
  QueueService,
  SendBird,
  SlackBot,
  StorageService,
  TwilioService,
} from '../src/providers';
import { User, UserService } from '../src/user';
import { Mutations, Queries } from './aux';
import { generateId } from './generators';
import { twilioPeerServiceToken } from './unit/mocks/twilioPeerServiceToken';

export class BaseHandler {
  app: INestApplication;
  mutations: Mutations;
  queries: Queries;
  module: GraphQLModule;
  userService: UserService;

  setContextUserId = (userId: string, roles: RoleTypes[] = [MemberRole.member]) => {
    (this.module as any).apolloServer.context = () => ({
      req: {
        user: {
          _id: userId,
          roles,
        },
      },
    });

    return this;
  };
}

export const urls = {
  scheduleAppointments: `/${apiPrefix}/appointments/schedule`,
  slots: `/${apiPrefix}/users/slots`,
  members: `/${apiPrefix}/members/create`,
  webhooks: `/${apiPrefix}/${webhooks}`,
};

export const compareUsers = (user: User, userBase) => {
  expect(user.firstName).toEqual(userBase.firstName);
  expect(user.lastName).toEqual(userBase.lastName);
  expect(user.email).toEqual(userBase.email);
  expect(user.roles).toEqual(expect.arrayContaining(userBase.roles));
  expect(user.avatar).toEqual(userBase.avatar);
  expect(user.createdAt).toEqual(expect.any(Date));
  expect(user.maxCustomers).toEqual(userBase.maxCustomers);
};

export const compareMembers = (member: Member, memberBase, primaryUserId?) => {
  expect(member.firstName).toEqual(memberBase.firstName);
  expect(member.lastName).toEqual(memberBase.lastName);
  expect(member.sex).toEqual(memberBase.sex ? memberBase.sex : defaultMemberParams.sex);
  expect(member.dateOfBirth).toEqual(member.dateOfBirth);
  expect(member.language).toEqual(
    memberBase.language ? memberBase.language : defaultMemberParams.language,
  );
  expect(member.zipCode).toEqual(member.zipCode);
  expect(member.honorific).toEqual(
    member.honorific ? member.honorific : defaultMemberParams.honorific,
  );
  expect(member.phone).toEqual(memberBase.phone);
  // could be one of the two
  try {
    expect(member.org.id.toString()).toEqual(memberBase.orgId.toString());
  } catch {
    expect(member.org.toString()).toEqual(memberBase.orgId.toString());
  }

  if (primaryUserId) {
    expect(member.primaryUserId).toEqual(primaryUserId);
  }
};

export const dbConnect = async () => {
  await connect(config.get('db.connection'), {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useFindAndModify: false,
    useCreateIndex: true,
  });
};

export const dbDisconnect = async () => {
  await disconnect();
};

export const defaultModules = () => {
  return [DbModule, EventEmitterModule.forRoot(), ScheduleModule.forRoot()];
};

export const mockLogger = (logger) => {
  jest.spyOn(logger, 'log').mockImplementation(() => undefined);
  jest.spyOn(logger, 'debug').mockImplementation(() => undefined);
  jest.spyOn(logger, 'error').mockImplementation(() => undefined);
  jest.spyOn(logger, 'info').mockImplementation(() => undefined);
  jest.spyOn(logger, 'warn').mockImplementation(() => undefined);
};

export const mockProviders = (
  module: TestingModule,
): {
  sendBird;
  notificationsService;
  twilioService;
  slackBot;
  cognitoService;
  storage;
  featureFlagService;
  queueService;
} => {
  const sendBird = module.get<SendBird>(SendBird);
  const storage = module.get<StorageService>(StorageService);
  const notificationsService = module.get<NotificationsService>(NotificationsService);
  const twilioService = module.get<TwilioService>(TwilioService);
  const slackBot = module.get<SlackBot>(SlackBot);
  const cognitoService = module.get<CognitoService>(CognitoService);
  const featureFlagService = module.get<FeatureFlagService>(FeatureFlagService);
  const queueService = module.get<QueueService>(QueueService);

  const spyOnFeatureFlagControlGroup = jest.spyOn(featureFlagService, 'isControlGroup');
  const spyOnSendBirdCreateUser = jest.spyOn(sendBird, 'createUser');
  const spyOnSendBirdCreateGroupChannel = jest.spyOn(sendBird, 'createGroupChannel');
  const spyOnSendBirdFreeze = jest.spyOn(sendBird, 'freezeGroupChannel');
  const spyOnSendBirdDeleteGroupChannel = jest.spyOn(sendBird, 'deleteGroupChannel');
  const spyOnSendBirdDeleteUser = jest.spyOn(sendBird, 'deleteUser');
  const spyOnSendBirdSend = jest.spyOn(sendBird, 'send');
  const spyOnSendBirdUpdateChannelName = jest.spyOn(sendBird, 'updateChannelName');
  const spyOnSendBirdInvite = jest.spyOn(sendBird, 'invite');
  const spyOnSendBirdLeave = jest.spyOn(sendBird, 'leave');
  const spyOnSendBirdUpdateGroupChannelMetadata = jest.spyOn(
    sendBird,
    'updateGroupChannelMetadata',
  );
  const spyOnSendBirdDeleteGroupChannelMetadata = jest.spyOn(
    sendBird,
    'deleteGroupChannelMetadata',
  );
  const spyOnStorageDownload = jest.spyOn(storage, 'getDownloadUrl');
  const spyOnStorageUpload = jest.spyOn(storage, 'getUploadUrl');
  const spyOnStorageDeleteRecordings = jest.spyOn(storage, 'deleteRecordings');
  const spyOnStorageDeleteJournalImages = jest.spyOn(storage, 'deleteJournalImages');
  const spyOnStorageHandleNewMember = jest.spyOn(storage, 'handleNewMember');
  const spyOnNotificationsServiceRegister = jest.spyOn(notificationsService, 'register');
  const spyOnNotificationsServiceUnregister = jest.spyOn(notificationsService, 'unregister');
  const spyOnNotificationsServiceSend = jest.spyOn(notificationsService, 'send');
  const spyOnNotificationsServiceCancel = jest.spyOn(notificationsService, 'cancel');
  const spyOnTwilioGetToken = jest.spyOn(twilioService, 'getAccessToken');
  const spyOnTwilioCreatePeerServiceToken = jest.spyOn(twilioService, 'createPeerServiceToken');
  const spyOnSlackBotSendMessage = jest.spyOn(slackBot, 'send');
  const spyOnCognitoServiceDisableMember = jest.spyOn(cognitoService, 'disableMember');
  const spyOnCognitoServiceDeleteMember = jest.spyOn(cognitoService, 'deleteMember');
  const spyOnQueueServiceSendMessage = jest.spyOn(queueService, 'sendMessage');

  spyOnSendBirdCreateUser.mockResolvedValue(v4());
  spyOnFeatureFlagControlGroup.mockResolvedValue(false);
  spyOnSendBirdCreateGroupChannel.mockResolvedValue(true);
  spyOnSendBirdFreeze.mockResolvedValue(undefined);
  spyOnSendBirdDeleteGroupChannel.mockResolvedValue(undefined);
  spyOnSendBirdDeleteUser.mockResolvedValue(undefined);
  spyOnSendBirdSend.mockResolvedValue(v4());
  spyOnSendBirdUpdateGroupChannelMetadata.mockResolvedValue(undefined);
  spyOnSendBirdDeleteGroupChannelMetadata.mockResolvedValue(undefined);
  spyOnStorageDownload.mockResolvedValue('https://some-url/download');
  spyOnStorageUpload.mockResolvedValue('https://some-url/upload');
  spyOnStorageDeleteRecordings.mockResolvedValue(undefined);
  spyOnStorageDeleteJournalImages.mockResolvedValue(true);
  spyOnStorageHandleNewMember.mockResolvedValue(undefined);
  spyOnNotificationsServiceRegister.mockResolvedValue(v4());
  spyOnNotificationsServiceUnregister.mockResolvedValue(undefined);
  spyOnNotificationsServiceSend.mockResolvedValue(v4());
  spyOnNotificationsServiceCancel.mockResolvedValue(v4());
  spyOnTwilioGetToken.mockReturnValue('token');
  spyOnTwilioCreatePeerServiceToken.mockResolvedValue(twilioPeerServiceToken);
  spyOnSlackBotSendMessage.mockReturnValue(undefined);
  spyOnSendBirdUpdateChannelName.mockReturnValue(undefined);
  spyOnSendBirdInvite.mockResolvedValue([generateId()]);
  spyOnSendBirdLeave.mockReturnValue(undefined);
  spyOnCognitoServiceDisableMember.mockReturnValue(undefined);
  spyOnCognitoServiceDeleteMember.mockReturnValue(undefined);
  spyOnQueueServiceSendMessage.mockReturnValue(undefined);

  return {
    sendBird: {
      spyOnSendBirdCreateUser,
      spyOnSendBirdCreateGroupChannel,
      spyOnSendBirdFreeze,
      spyOnSendBirdDeleteGroupChannel,
      spyOnSendBirdDeleteUser,
      spyOnSendBirdSend,
      spyOnSendBirdUpdateGroupChannelMetadata,
      spyOnSendBirdDeleteGroupChannelMetadata,
      spyOnSendBirdUpdateChannelName,
      spyOnSendBirdInvite,
      spyOnSendBirdLeave,
    },
    notificationsService: {
      spyOnNotificationsServiceRegister,
      spyOnNotificationsServiceUnregister,
      spyOnNotificationsServiceSend,
      spyOnNotificationsServiceCancel,
    },
    twilioService: { spyOnTwilioGetToken, spyOnTwilioCreatePeerServiceToken },
    slackBot: { spyOnSlackBotSendMessage },
    cognitoService: { spyOnCognitoServiceDisableMember, spyOnCognitoServiceDeleteMember },
    storage: {
      spyOnStorageDownload,
      spyOnStorageUpload,
      spyOnStorageDeleteRecordings,
      spyOnStorageDeleteJournalImages,
      spyOnStorageHandleNewMember,
    },
    featureFlagService: { spyOnFeatureFlagControlGroup },
    queueService: { spyOnQueueServiceSendMessage },
  };
};
