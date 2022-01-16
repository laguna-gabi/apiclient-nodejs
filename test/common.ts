import { INestApplication } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { GraphQLModule } from '@nestjs/graphql';
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
  OneSignal,
  QueueService,
  SendBird,
  SlackBot,
  StorageService,
  TwilioService,
} from '../src/providers';
import { User, UserService } from '../src/user';
import { Mutations, Queries } from './aux';
import { generateId } from './generators';

export class BaseHandler {
  app: INestApplication;
  mutations: Mutations;
  queries: Queries;
  module: GraphQLModule;
  userService: UserService;

  setContextUserId = (
    userId: string,
    primaryUserId = '',
    roles: RoleTypes[] = [MemberRole.member],
  ) => {
    (this.module as any).apolloServer.context = () => ({
      req: {
        user: {
          _id: userId,
          roles,
          primaryUserId,
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
  return [DbModule, EventEmitterModule.forRoot()];
};

export const mockProviders = (
  module: TestingModule,
): {
  sendBird;
  oneSignal;
  twilioService;
  slackBot;
  cognitoService;
  storage;
  featureFlagService;
  queueService;
} => {
  const sendBird = module.get<SendBird>(SendBird);
  const storage = module.get<StorageService>(StorageService);
  const oneSignal = module.get<OneSignal>(OneSignal);
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
  const spyOnStorageMultipartUpload = jest.spyOn(storage, 'getMultipartUploadUrl');
  const spyOnStorageDeleteRecordings = jest.spyOn(storage, 'deleteRecordings');
  const spyOnStorageDeleteJournalImages = jest.spyOn(storage, 'deleteJournalImages');
  const spyOnStorageHandleNewMember = jest.spyOn(storage, 'handleNewMember');
  const spyOnOneSignalRegister = jest.spyOn(oneSignal, 'register');
  const spyOnOneSignalUnregister = jest.spyOn(oneSignal, 'unregister');
  const spyOnTwilioGetToken = jest.spyOn(twilioService, 'getAccessToken');
  const spyOnTwilioValidateWebhook = jest.spyOn(twilioService, 'validateWebhook');
  const spyOnTwilioGetPhoneCarrier = jest.spyOn(twilioService, 'getPhoneCarrier');
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
  spyOnSendBirdUpdateGroupChannelMetadata.mockResolvedValue(undefined);
  spyOnSendBirdDeleteGroupChannelMetadata.mockResolvedValue(undefined);
  spyOnStorageDownload.mockResolvedValue('https://some-url/download');
  spyOnStorageUpload.mockResolvedValue('https://some-url/upload');
  spyOnStorageMultipartUpload.mockResolvedValue({
    url: 'https://some-url/multipartUpload',
    uploadId: 'some_upload_id',
  });
  spyOnStorageDeleteRecordings.mockResolvedValue(undefined);
  spyOnStorageDeleteJournalImages.mockResolvedValue(true);
  spyOnStorageHandleNewMember.mockResolvedValue(undefined);
  spyOnOneSignalRegister.mockResolvedValue(v4());
  spyOnOneSignalUnregister.mockResolvedValue(undefined);
  spyOnTwilioGetToken.mockReturnValue('token');
  spyOnTwilioValidateWebhook.mockReturnValue(true);
  spyOnTwilioGetPhoneCarrier.mockResolvedValue('mobile');
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
      spyOnSendBirdUpdateGroupChannelMetadata,
      spyOnSendBirdDeleteGroupChannelMetadata,
      spyOnSendBirdUpdateChannelName,
      spyOnSendBirdInvite,
      spyOnSendBirdLeave,
    },
    oneSignal: {
      spyOnOneSignalRegister,
      spyOnOneSignalUnregister,
    },
    twilioService: {
      spyOnTwilioGetToken,
      spyOnTwilioValidateWebhook,
      spyOnTwilioGetPhoneCarrier,
    },
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
