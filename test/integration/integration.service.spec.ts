import {
  CancelNotificationType,
  CustomKey,
  ExternalKey,
  InnerQueueTypes,
  InternalKey,
  InternalNotificationType,
  NotificationType,
  ObjectAppointmentScheduleReminderClass,
  ObjectAppointmentScheduledClass,
  ObjectBaseClass,
  ObjectChatMessageUserClass,
  ObjectExternalContentClass,
  ObjectFutureNotifyClass,
  ObjectJournalContentClass,
  ObjectNewChatMessageToMemberClass,
  ObjectNewMemberClass,
  ObjectNewMemberNudgeClass,
  Platform,
  generateAppointmentScheduleReminderMock,
  generateAppointmentScheduledMemberMock,
  generateAppointmentScheduledUserMock,
  generateChatMessageUserMock,
  generateExternalContentMock,
  generateNewChatMessageToMemberMock,
  generateNewControlMemberMock,
  generateNewMemberMock,
  generateNewMemberNudgeMock,
  generateObjectCallOrVideoMock,
  generateObjectCancelMock,
  generateObjectFutureNotifyMock,
  generateObjectJournalContentMock,
  generateRequestAppointmentMock,
  generateTextMessageUserMock,
  mockLogger,
} from '@lagunahealth/pandora';
import { Test, TestingModule } from '@nestjs/testing';
import { gapMinutes, hosts } from 'config';
import { addDays, subMinutes } from 'date-fns';
import { internet, lorem } from 'faker';
import { Types } from 'mongoose';
import { SQSMessage } from 'sqs-consumer';
import { v4 } from 'uuid';
import { replaceConfigs } from '../';
import { translation } from '../../languages/en.json';
import { AppModule } from '../../src/app.module';
import { Logger } from '../../src/common';
import {
  DispatchStatus,
  DispatchesService,
  QueueService,
  TriggersService,
} from '../../src/conductor';
import {
  ConfigsService,
  InternationalizationService,
  NotificationsService,
  OneSignal,
  Provider,
  ProviderResult,
  SendBird,
  SendSendBirdNotification,
  Twilio,
} from '../../src/providers';
import { ClientSettings } from '../../src/settings';
import {
  generateId,
  generateUpdateMemberSettingsMock,
  generateUpdateUserSettingsMock,
} from '../generators';
import { iceServers } from './twilioPeerIceServers';

describe('Notifications full flow', () => {
  let module: TestingModule;
  let service: QueueService;
  let dispatchesService: DispatchesService;
  let triggersService: TriggersService;
  let spyOnTwilioSend;
  let spyOnOneSignalSend;
  let spyOnOneSignalCancel;
  let spyOnSendBirdSend;
  let internationalizationService: InternationalizationService;
  let notificationsService: NotificationsService;
  let webMemberClient: ClientSettings;
  let mobileMemberClient: ClientSettings;
  let userClient: ClientSettings;

  const providerResult: ProviderResult = {
    provider: Provider.twilio,
    content: lorem.sentence(),
    id: generateId(),
  };

  beforeAll(async () => {
    module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    mockLogger(module.get<Logger>(Logger));
    service = module.get<QueueService>(QueueService);
    dispatchesService = module.get<DispatchesService>(DispatchesService);
    triggersService = module.get<TriggersService>(TriggersService);

    const twilio = module.get<Twilio>(Twilio);
    spyOnTwilioSend = jest.spyOn(twilio, 'send');
    spyOnTwilioSend.mockReturnValue(undefined);
    const spyOnTwilioCreatePeerIceServers = jest.spyOn(twilio, 'createPeerIceServers');
    spyOnTwilioCreatePeerIceServers.mockResolvedValue({ iceServers });

    const oneSignal = module.get<OneSignal>(OneSignal);
    spyOnOneSignalSend = jest.spyOn(oneSignal, 'send');
    spyOnOneSignalSend.mockReturnValue(undefined);

    const sendBird = module.get<SendBird>(SendBird);
    spyOnSendBirdSend = jest.spyOn(sendBird, 'send');
    spyOnSendBirdSend.mockReturnValue(undefined);
    spyOnOneSignalCancel = jest.spyOn(oneSignal, 'cancel');
    spyOnOneSignalCancel.mockReturnValue(undefined);

    const configsService = module.get<ConfigsService>(ConfigsService);
    jest.spyOn(configsService, 'getConfig').mockResolvedValue(lorem.word());

    notificationsService = module.get<NotificationsService>(NotificationsService);
    internationalizationService = module.get<InternationalizationService>(
      InternationalizationService,
    );
    await internationalizationService.onModuleInit();

    await initClients();
  }, 10000);

  afterEach(() => {
    spyOnTwilioSend.mockReset();
    spyOnOneSignalSend.mockReset();
    spyOnOneSignalCancel.mockReset();
    spyOnSendBirdSend.mockReset();
  });

  afterAll(async () => {
    await module.close();
    spyOnTwilioSend.mockRestore();
    spyOnOneSignalSend.mockRestore();
    spyOnOneSignalCancel.mockRestore();
    spyOnSendBirdSend.mockRestore();
  });

  it(`should handle 'immediate' event of type ${InternalKey.newMember}`, async () => {
    const object = new ObjectNewMemberClass(
      generateNewMemberMock({
        recipientClientId: webMemberClient.id,
        senderClientId: userClient.id,
      }),
    );
    spyOnTwilioSend.mockReturnValueOnce(providerResult);

    const message: SQSMessage = {
      MessageId: v4(),
      Body: JSON.stringify({ type: InnerQueueTypes.createDispatch, ...object.objectNewMemberMock }),
    };
    await service.handleMessage(message);

    const body = replaceConfigs({
      content: translation.contents[InternalKey.newMember],
      memberClient: webMemberClient,
      userClient,
      appointmentId: object.objectNewMemberMock.appointmentId,
    });
    expect(spyOnTwilioSend).toBeCalledWith({
      body,
      orgName: webMemberClient.orgName,
      to: webMemberClient.phone,
    });

    await compareResults({
      dispatchId: object.objectNewMemberMock.dispatchId,
      status: DispatchStatus.done,
      response: { ...object.objectNewMemberMock },
    });
  });

  it(`should handle 'immediate' event of type ${InternalKey.newControlMember}`, async () => {
    const object = new ObjectBaseClass(
      generateNewControlMemberMock({
        recipientClientId: webMemberClient.id,
      }),
    );
    spyOnTwilioSend.mockReturnValueOnce(providerResult);

    const message: SQSMessage = {
      MessageId: v4(),
      Body: JSON.stringify({ type: InnerQueueTypes.createDispatch, ...object.objectBaseType }),
    };
    await service.handleMessage(message);

    expect(spyOnTwilioSend).toBeCalledWith({
      body: translation.contents[InternalKey.newControlMember],
      orgName: webMemberClient.orgName,
      to: webMemberClient.phone,
    });

    await compareResults({
      dispatchId: object.objectBaseType.dispatchId,
      status: DispatchStatus.done,
      response: { ...object.objectBaseType },
    });
  });

  it(`should handle 'future' event of type ${InternalKey.newMemberNudge}`, async () => {
    const object = new ObjectNewMemberNudgeClass(
      generateNewMemberNudgeMock({
        recipientClientId: webMemberClient.id,
        senderClientId: userClient.id,
      }),
    );

    const message: SQSMessage = {
      MessageId: v4(),
      Body: JSON.stringify({
        type: InnerQueueTypes.createDispatch,
        ...object.objectNewMemberNudgeMock,
      }),
    };
    await service.handleMessage(message);

    const trigger = await triggersService.get(object.objectNewMemberNudgeMock.dispatchId);
    expect(trigger.expireAt).toEqual(object.objectNewMemberNudgeMock.triggersAt);
    await compareResults({
      dispatchId: object.objectNewMemberNudgeMock.dispatchId,
      status: DispatchStatus.received,
      response: { ...object.objectNewMemberNudgeMock },
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      triggeredId: trigger._id.toString(),
    });
  });

  test.each([
    InternalKey.newRegisteredMember,
    InternalKey.newRegisteredMemberNudge,
    InternalKey.logReminder,
  ])(
    // eslint-disable-next-line max-len
    `should handle 'future' event of type %p(faking it to trigger now) and send to sendbird and twilio on ${NotificationType.textSms}`,
    async (contentKey) => {
      const mock = generateObjectFutureNotifyMock({
        recipientClientId: webMemberClient.id,
        senderClientId: userClient.id,
        contentKey,
        notificationType: NotificationType.textSms,
        //setting this to now in order to check that sendbird is called as well
        triggersAt: new Date(),
        sendBirdChannelUrl: internet.url(),
      });

      const object = new ObjectFutureNotifyClass(mock);
      spyOnTwilioSend.mockReturnValueOnce(providerResult);

      const message: SQSMessage = {
        MessageId: v4(),
        Body: JSON.stringify({
          type: InnerQueueTypes.createDispatch,
          ...object.objectFutureNotifyType,
        }),
      };
      await service.handleMessage(message);

      const content =
        replaceConfigs({
          content: translation.contents[contentKey],
          memberClient: webMemberClient,
          userClient,
        }) + `\n${hosts.get('dynamicLink')}`;

      const sendbirdParams: SendSendBirdNotification = {
        message: content,
        notificationType: mock.notificationType,
        orgName: webMemberClient.orgName,
        sendBirdChannelUrl: mock.sendBirdChannelUrl,
        userId: userClient.id,
        appointmentId: undefined,
        journalImageDownloadLink: undefined,
        journalAudioDownloadLink: undefined,
      };
      expect(spyOnSendBirdSend).toBeCalledWith(sendbirdParams);

      expect(spyOnTwilioSend).toBeCalledWith({
        body: content,
        orgName: webMemberClient.orgName,
        to: webMemberClient.phone,
      });

      await compareResults({
        dispatchId: mock.dispatchId,
        status: DispatchStatus.done,
        response: { ...object.objectFutureNotifyType },
        pResult: providerResult,
      });
    },
  );

  test.each([
    { contentKey: InternalKey.newRegisteredMember, amount: 1 },
    { contentKey: InternalKey.newRegisteredMemberNudge, amount: 2 },
    { contentKey: InternalKey.logReminder, amount: 3 },
  ])(`should handle 'future' event of type $contentKey`, async (params) => {
    const object = new ObjectFutureNotifyClass(
      generateObjectFutureNotifyMock({
        recipientClientId: mobileMemberClient.id,
        senderClientId: userClient.id,
        contentKey: params.contentKey,
        notificationType: NotificationType.text,
        triggersAt: addDays(new Date(), params.amount),
        sendBirdChannelUrl: internet.url(),
      }),
    );

    const message: SQSMessage = {
      MessageId: v4(),
      Body: JSON.stringify({
        type: InnerQueueTypes.createDispatch,
        ...object.objectFutureNotifyType,
      }),
    };
    await service.handleMessage(message);

    const trigger = await triggersService.get(object.objectFutureNotifyType.dispatchId);
    expect(trigger.expireAt).toEqual(object.objectFutureNotifyType.triggersAt);
    await compareResults({
      dispatchId: object.objectFutureNotifyType.dispatchId,
      status: DispatchStatus.received,
      response: { ...object.objectFutureNotifyType },
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      triggeredId: trigger._id.toString(),
    });
  });

  test.each([
    { contentKey: InternalKey.appointmentReminder, amountMinutes: gapMinutes },
    { contentKey: InternalKey.appointmentLongReminder, amountMinutes: 24 * 60 },
  ])(`should handle 'future' event of type $contentKey`, async (params) => {
    const appointmentTime = addDays(new Date(), 3);
    const object = new ObjectAppointmentScheduleReminderClass(
      generateAppointmentScheduleReminderMock({
        recipientClientId: webMemberClient.id,
        senderClientId: userClient.id,
        contentKey: params.contentKey,
        appointmentId: generateId(),
        appointmentTime,
        triggersAt: subMinutes(appointmentTime, params.amountMinutes),
      }),
    );

    const message: SQSMessage = {
      MessageId: v4(),
      Body: JSON.stringify({
        type: InnerQueueTypes.createDispatch,
        ...object.objectAppointmentScheduleReminderMock,
      }),
    };
    await service.handleMessage(message);

    const trigger = await triggersService.get(
      object.objectAppointmentScheduleReminderMock.dispatchId,
    );
    expect(trigger.expireAt).toEqual(object.objectAppointmentScheduleReminderMock.triggersAt);
    await compareResults({
      dispatchId: object.objectAppointmentScheduleReminderMock.dispatchId,
      status: DispatchStatus.received,
      response: { ...object.objectAppointmentScheduleReminderMock },
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      triggeredId: trigger._id.toString(),
    });
  });

  /* eslint-disable max-len */
  it(`should handle 'immediate' event of type ${InternalKey.appointmentScheduledUser}`, async () => {
    /* eslint-enable max-len */
    const mock = generateAppointmentScheduledUserMock({
      recipientClientId: userClient.id,
      senderClientId: webMemberClient.id,
      appointmentId: generateId(),
      appointmentTime: addDays(new Date(), 1),
    });
    const object = new ObjectAppointmentScheduledClass(mock);
    spyOnTwilioSend.mockReturnValueOnce(providerResult);

    const message: SQSMessage = {
      MessageId: v4(),
      Body: JSON.stringify({
        type: InnerQueueTypes.createDispatch,
        ...object.objectAppointmentScheduledType,
      }),
    };
    await service.handleMessage(message);

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const realAppointmentTime = notificationsService.formatAppointmentTime(
      userClient,
      mock.appointmentTime,
    );
    const body = replaceConfigs({
      content: translation.contents[InternalKey.appointmentScheduledUser],
      memberClient: webMemberClient,
      userClient,
      appointmentTime: realAppointmentTime,
    });
    expect(spyOnTwilioSend).toBeCalledWith({ body, orgName: undefined, to: userClient.phone });

    await compareResults({
      dispatchId: mock.dispatchId,
      status: DispatchStatus.done,
      response: { ...object.objectAppointmentScheduledType },
    });
  });

  // eslint-disable-next-line max-len
  it(`should handle 'immediate' event of type ${InternalKey.appointmentScheduledMember}`, async () => {
    const mock = generateAppointmentScheduledMemberMock({
      recipientClientId: webMemberClient.id,
      senderClientId: userClient.id,
      appointmentId: generateId(),
      appointmentTime: addDays(new Date(), 1),
    });
    const object = new ObjectAppointmentScheduledClass(mock);
    spyOnTwilioSend.mockReturnValueOnce(providerResult);

    const message: SQSMessage = {
      MessageId: v4(),
      Body: JSON.stringify({
        type: InnerQueueTypes.createDispatch,
        ...object.objectAppointmentScheduledType,
      }),
    };
    await service.handleMessage(message);

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const realAppointmentTime = notificationsService.formatAppointmentTime(
      webMemberClient,
      mock.appointmentTime,
    );
    const body = replaceConfigs({
      content: translation.contents[InternalKey.appointmentScheduledMember],
      memberClient: webMemberClient,
      userClient,
      appointmentTime: realAppointmentTime,
    });
    expect(spyOnTwilioSend).toBeCalledWith({
      body,
      orgName: webMemberClient.orgName,
      to: webMemberClient.phone,
    });

    await compareResults({
      dispatchId: mock.dispatchId,
      status: DispatchStatus.done,
      response: { ...object.objectAppointmentScheduledType },
    });
  });

  it(`should handle 'immediate' event of type ${InternalKey.appointmentRequest}`, async () => {
    const mock = generateRequestAppointmentMock({
      recipientClientId: webMemberClient.id,
      senderClientId: userClient.id,
      appointmentId: new Types.ObjectId().toString(),
      scheduleLink: internet.url(),
    });
    spyOnTwilioSend.mockReturnValueOnce(providerResult);

    const message: SQSMessage = {
      MessageId: v4(),
      Body: JSON.stringify(
        { type: InnerQueueTypes.createDispatch, ...mock },
        Object.keys(mock).sort(),
      ),
    };
    await service.handleMessage(message);

    let body = replaceConfigs({
      content: translation.contents[InternalKey.appointmentRequest],
      memberClient: webMemberClient,
      userClient,
    });

    body += `:\n${mock.scheduleLink}.`;

    expect(spyOnTwilioSend).toBeCalledWith({
      body,
      orgName: webMemberClient.orgName,
      to: webMemberClient.phone,
    });

    await compareResults({
      dispatchId: mock.dispatchId,
      status: DispatchStatus.done,
      response: { ...mock },
    });
  });

  test.each([InternalKey.newChatMessageFromMember, InternalKey.memberNotFeelingWellMessage])(
    `should handle 'immediate' event of type %p`,
    async (contentKey) => {
      const mock = generateTextMessageUserMock({
        recipientClientId: userClient.id,
        senderClientId: webMemberClient.id,
        contentKey,
      });
      const object = new ObjectBaseClass(mock);
      spyOnTwilioSend.mockReturnValueOnce(providerResult);

      const message: SQSMessage = {
        MessageId: v4(),
        Body: JSON.stringify({ type: InnerQueueTypes.createDispatch, ...object.objectBaseType }),
      };
      await service.handleMessage(message);

      const body = replaceConfigs({
        content: translation.contents[contentKey],
        memberClient: webMemberClient,
        userClient,
      });
      expect(spyOnTwilioSend).toBeCalledWith({
        body,
        orgName: undefined,
        to: userClient.phone,
      });

      await compareResults({
        dispatchId: mock.dispatchId,
        status: DispatchStatus.done,
        response: { ...object.objectBaseType },
      });
    },
  );

  it(`should handle 'immediate' event of type ${InternalKey.newChatMessageFromUser}`, async () => {
    const mock = generateNewChatMessageToMemberMock({
      recipientClientId: webMemberClient.id,
      senderClientId: userClient.id,
    });
    const object = new ObjectNewChatMessageToMemberClass(mock);
    spyOnTwilioSend.mockReturnValueOnce(providerResult);

    const message: SQSMessage = {
      MessageId: v4(),
      Body: JSON.stringify({
        type: InnerQueueTypes.createDispatch,
        ...object.objectNewChatMessageFromUserType,
      }),
    };
    await service.handleMessage(message);

    const body = replaceConfigs({
      content: translation.contents[InternalKey.newChatMessageFromUser],
      memberClient: webMemberClient,
      userClient,
    });
    expect(spyOnTwilioSend).toBeCalledWith({
      body,
      orgName: webMemberClient.orgName,
      to: webMemberClient.phone,
    });

    await compareResults({
      dispatchId: mock.dispatchId,
      status: DispatchStatus.done,
      response: { ...object.objectNewChatMessageFromUserType },
    });
  });

  test.each([NotificationType.video, NotificationType.call])(
    `should handle 'immediate' event of type ${CustomKey.callOrVideo} (%p)`,
    async (notificationType) => {
      const mock = generateObjectCallOrVideoMock({
        recipientClientId: mobileMemberClient.id,
        senderClientId: userClient.id,
        notificationType,
        peerId: v4(),
        path: lorem.word(),
        sendBirdChannelUrl: internet.url(),
      });
      const providerResultOS: ProviderResult = { provider: Provider.oneSignal, id: generateId() };
      spyOnOneSignalSend.mockReturnValueOnce(providerResultOS);

      const message: SQSMessage = {
        MessageId: v4(),
        Body: JSON.stringify(
          { type: InnerQueueTypes.createDispatch, ...mock },
          Object.keys(mock).sort(),
        ),
      };
      await service.handleMessage(message);

      expect(spyOnOneSignalSend).toBeCalledWith({
        externalUserId: mobileMemberClient.externalUserId,
        platform: mobileMemberClient.platform,
        data: {
          user: { id: userClient.id, firstName: userClient.firstName, avatar: userClient.avatar },
          member: { phone: mobileMemberClient.phone },
          type: mock.notificationType,
          peerId: mock.peerId,
          isVideo: mock.notificationType === NotificationType.video,
          path: mock.path,
          extraData: JSON.stringify({ iceServers }),
          content: undefined,
        },
        orgName: mobileMemberClient.orgName,
      });

      await compareResults({
        dispatchId: mock.dispatchId,
        status: DispatchStatus.done,
        response: { ...mock },
        pResult: providerResultOS,
      });
    },
  );

  it(`should handle 'immediate' event of type ${CustomKey.customContent}`, async () => {
    const mock = generateChatMessageUserMock({
      recipientClientId: userClient.id,
      senderClientId: webMemberClient.id,
      content: lorem.word(),
      sendBirdChannelUrl: internet.url(),
    });
    const object = new ObjectChatMessageUserClass(mock);
    spyOnSendBirdSend.mockReturnValueOnce(providerResult);

    const message: SQSMessage = {
      MessageId: v4(),
      Body: JSON.stringify({
        type: InnerQueueTypes.createDispatch,
        ...object.objectChatMessageUserType,
      }),
    };
    await service.handleMessage(message);

    expect(spyOnSendBirdSend).toBeCalledWith({
      message: mock.content,
      notificationType: InternalNotificationType.chatMessageToUser,
      orgName: undefined,
      sendBirdChannelUrl: mock.sendBirdChannelUrl,
      userId: webMemberClient.id,
    });

    await compareResults({
      dispatchId: mock.dispatchId,
      status: DispatchStatus.done,
      response: { ...object.objectChatMessageUserType },
    });
  });

  it(`should handle 'immediate' event of type ${CustomKey.journalContent}`, async () => {
    const mock = generateObjectJournalContentMock({
      recipientClientId: userClient.id,
      senderClientId: webMemberClient.id,
      content: lorem.word(),
      sendBirdChannelUrl: internet.url(),
    });
    const object = new ObjectJournalContentClass(mock);
    spyOnSendBirdSend.mockReturnValueOnce(providerResult);

    const message: SQSMessage = {
      MessageId: v4(),
      Body: JSON.stringify({
        type: InnerQueueTypes.createDispatch,
        ...object.objectCustomContentType,
      }),
    };
    await service.handleMessage(message);

    expect(spyOnSendBirdSend).toBeCalledWith({
      message: mock.content,
      notificationType: InternalNotificationType.chatMessageJournal,
      orgName: undefined,
      sendBirdChannelUrl: mock.sendBirdChannelUrl,
      userId: webMemberClient.id,
    });

    await compareResults({
      dispatchId: mock.dispatchId,
      status: DispatchStatus.done,
      response: { ...object.objectCustomContentType },
    });
  });

  test.each(Object.values(ExternalKey))(
    `should handle 'immediate' event of type %p`,
    async (contentKey) => {
      const mock = generateExternalContentMock({
        recipientClientId: mobileMemberClient.id,
        senderClientId: userClient.id,
        contentKey,
        path: lorem.word(),
      });
      const object = new ObjectExternalContentClass(mock);

      const providerResultOS: ProviderResult = { provider: Provider.oneSignal, id: generateId() };
      spyOnOneSignalSend.mockReturnValueOnce(providerResultOS);

      const message: SQSMessage = {
        MessageId: v4(),
        Body: JSON.stringify({
          type: InnerQueueTypes.createDispatch,
          ...object.objectExternalContentType,
        }),
      };
      await service.handleMessage(message);

      const content = replaceConfigs({
        content: translation.contents[contentKey],
        memberClient: mobileMemberClient,
        userClient,
      });

      expect(spyOnOneSignalSend).toBeCalledWith({
        externalUserId: mobileMemberClient.externalUserId,
        platform: mobileMemberClient.platform,
        data: {
          user: { id: userClient.id, firstName: userClient.firstName, avatar: userClient.avatar },
          member: { phone: mobileMemberClient.phone },
          type: mock.notificationType,
          isVideo: false,
          path: mock.path,
        },
        content,
        orgName: mobileMemberClient.orgName,
      });

      await compareResults({
        dispatchId: mock.dispatchId,
        status: DispatchStatus.done,
        response: { ...mock },
        pResult: providerResultOS,
      });
    },
  );

  test.each(Object.values(CancelNotificationType))(
    `should handle 'immediate' event of type ${CustomKey.cancelNotify} %p`,
    async (notificationType) => {
      const mock = generateObjectCancelMock({
        recipientClientId: mobileMemberClient.id,
        notificationType,
        peerId: v4(),
      });

      const providerResultOS: ProviderResult = { provider: Provider.oneSignal, id: generateId() };
      spyOnOneSignalCancel.mockReturnValueOnce(providerResultOS);

      const message: SQSMessage = {
        MessageId: v4(),
        Body: JSON.stringify(
          { type: InnerQueueTypes.createDispatch, ...mock },
          Object.keys(mock).sort(),
        ),
      };
      await service.handleMessage(message);

      expect(spyOnOneSignalCancel).toBeCalledWith({
        externalUserId: mobileMemberClient.externalUserId,
        platform: mobileMemberClient.platform,
        data: {
          type: mock.notificationType,
          peerId: mock.peerId,
        },
      });

      await compareResults({
        dispatchId: mock.dispatchId,
        status: DispatchStatus.done,
        response: { ...mock },
        pResult: providerResultOS,
      });
    },
  );

  /*************************************************************************************************
   ******************************************** Helpers ********************************************
   ************************************************************************************************/
  const initClients = async () => {
    webMemberClient = generateUpdateMemberSettingsMock({ platform: Platform.web });
    const webMemberClientMessage: SQSMessage = {
      MessageId: v4(),
      Body: JSON.stringify({ type: InnerQueueTypes.updateClientSettings, ...webMemberClient }),
    };
    await service.handleMessage(webMemberClientMessage);

    mobileMemberClient = generateUpdateMemberSettingsMock({
      platform: Platform.android,
      isPushNotificationsEnabled: true,
      isAppointmentsReminderEnabled: true,
    });
    const mobileMemberClientMessage: SQSMessage = {
      MessageId: v4(),
      Body: JSON.stringify({ type: InnerQueueTypes.updateClientSettings, ...mobileMemberClient }),
    };
    await service.handleMessage(mobileMemberClientMessage);

    userClient = generateUpdateUserSettingsMock();
    const userClientM: SQSMessage = {
      MessageId: v4(),
      Body: JSON.stringify({ type: InnerQueueTypes.updateClientSettings, ...userClient }),
    };
    await service.handleMessage(userClientM);
  };

  const compareResults = async ({
    dispatchId,
    status,
    response,
    triggeredId,
    pResult = providerResult,
  }: {
    dispatchId: string;
    status: DispatchStatus;
    response;
    triggeredId?;
    pResult?: ProviderResult;
  }) => {
    const result = await dispatchesService.get(dispatchId);
    delete response.type;

    const providerResultObject = status === DispatchStatus.done ? { providerResult: pResult } : {};
    const sentAtObject = status === DispatchStatus.done ? { sentAt: expect.any(Date) } : {};
    const triggeredIdObject = status === DispatchStatus.received ? { triggeredId } : {};

    expect(result).toEqual({
      ...response,
      ...providerResultObject,
      ...triggeredIdObject,
      ...sentAtObject,
      failureReasons: [],
      retryCount: 0,
      status,
    });
  };
});
