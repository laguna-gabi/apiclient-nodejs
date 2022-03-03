import { INestApplication } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { GraphQLModule } from '@nestjs/graphql';
import { TestingModule } from '@nestjs/testing';
import { db } from 'config';
import { Document, Model, Types, connect, disconnect } from 'mongoose';
import { v4 } from 'uuid';
import { AppRequestContext, RequestContext, apiPrefix, webhooks } from '../src/common';
import { Audit, DbModule } from '../src/db';
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
import { NotificationService } from '../src/services';
import { User, UserService } from '../src/user';
import { Handler, Mutations, Queries } from './aux';
import {
  generateCarePlanTypeInput,
  generateCreateBarrierParamsWizard,
  generateCreateCarePlanParamsWizard,
  generateCreateRedFlagParamsWizard,
  generateId,
  generateSubmitCareWizardParams,
} from './generators';

export class BaseHandler {
  app: INestApplication;
  mutations: Mutations;
  queries: Queries;
  module: GraphQLModule;
  userService: UserService;
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

export const checkDelete = (deletedResult, paramsToTest, deletedBy: string) => {
  expect(deletedResult).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        deleted: true,
        deletedAt: expect.any(Date),
        deletedBy: new Types.ObjectId(deletedBy),
        ...paramsToTest,
      }),
    ]),
  );
};

export const submitMockCareWizard = async (handler: Handler, memberId: string, requestHeaders?) => {
  const carePlanTypeInput1 = generateCarePlanTypeInput({ id: handler.carePlanType.id });
  const carePlan = generateCreateCarePlanParamsWizard({ type: carePlanTypeInput1 });
  const barrier = generateCreateBarrierParamsWizard({
    type: handler.barrierType.id,
    carePlans: [carePlan],
  });
  const redFlag = generateCreateRedFlagParamsWizard({ barriers: [barrier] });
  const wizardParams = generateSubmitCareWizardParams({ redFlag, memberId });
  const result = await handler.mutations.submitCareWizard({
    submitCareWizardParams: wizardParams,
    requestHeaders,
  });
  expect(result).toBeTruthy();
};

export const dbConnect = async () => {
  await connect(db.connection);
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
  notificationService;
} => {
  const sendBird = module.get<SendBird>(SendBird);
  const storage = module.get<StorageService>(StorageService);
  const oneSignal = module.get<OneSignal>(OneSignal);
  const twilioService = module.get<TwilioService>(TwilioService);
  const slackBot = module.get<SlackBot>(SlackBot);
  const cognitoService = module.get<CognitoService>(CognitoService);
  const featureFlagService = module.get<FeatureFlagService>(FeatureFlagService);
  const queueService = module.get<QueueService>(QueueService);
  const notificationService = module.get<NotificationService>(NotificationService);

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
  const spyOnTwilioGetPhoneType = jest.spyOn(twilioService, 'getPhoneType');
  const spyOnSlackBotSendMessage = jest.spyOn(slackBot, 'send');
  const spyOnCognitoServiceDisableMember = jest.spyOn(cognitoService, 'disableMember');
  const spyOnCognitoServiceDeleteMember = jest.spyOn(cognitoService, 'deleteMember');
  const spyOnQueueServiceSendMessage = jest.spyOn(queueService, 'sendMessage');
  const spyOnNotificationServiceGetDispatchesByClientSenderId = jest.spyOn(
    notificationService,
    'getDispatchesByClientSenderId',
  );

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
  spyOnTwilioGetPhoneType.mockResolvedValue('mobile');
  spyOnSlackBotSendMessage.mockReturnValue(undefined);
  spyOnSendBirdUpdateChannelName.mockReturnValue(undefined);
  spyOnSendBirdInvite.mockResolvedValue([generateId()]);
  spyOnSendBirdLeave.mockReturnValue(undefined);
  spyOnCognitoServiceDisableMember.mockReturnValue(undefined);
  spyOnCognitoServiceDeleteMember.mockReturnValue(undefined);
  spyOnQueueServiceSendMessage.mockReturnValue(undefined);
  spyOnNotificationServiceGetDispatchesByClientSenderId.mockResolvedValue([undefined]);

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
      spyOnTwilioGetPhoneType,
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
    notificationService: { spyOnNotificationServiceGetDispatchesByClientSenderId },
  };
};

export const loadSessionClient = (clientId: string) => {
  let ctx: AppRequestContext = RequestContext.get();

  if (!ctx) {
    RequestContext.start(AppRequestContext);
    ctx = RequestContext.get();
  }

  ctx.client = clientId;
};

export async function checkAuditValues<TDoc extends Document>(
  id: string,
  model: Model<TDoc>,
  expectedCreatedBy: string,
  expectedUpdatedBy: string,
): Promise<boolean> {
  const doc: Audit = await model.findOne({ _id: new Types.ObjectId(id) });
  return (
    doc.createdBy?.toString() === expectedCreatedBy &&
    doc.updatedBy?.toString() === expectedUpdatedBy
  );
}
export const isResultValid = ({
  errors,
  invalidFieldsErrors,
  missingFieldError = undefined,
}): boolean => {
  if (invalidFieldsErrors) {
    for (let i = 0; i < invalidFieldsErrors.length; i++) {
      expect(errors[0][i]?.message || errors[0]?.message).toContain(invalidFieldsErrors[i]);
      expect(errors[0][i]?.code || errors[0]?.code).not.toEqual(-1);
    }
  } else if (missingFieldError) {
    expect(errors[0].message || errors[0][0].message).toMatch(missingFieldError);
    expect(errors[0].code || errors[0][0].code).toEqual(-1);
  } else {
    return true;
  }

  return false;
};
