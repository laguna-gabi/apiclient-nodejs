import {
  AlertInternalKey,
  AppointmentInternalKey,
  CancelNotificationType,
  Categories,
  ChatInternalKey,
  ExternalKey,
  InnerQueueTypes,
  JournalCustomKey,
  LogInternalKey,
  NotificationType,
  NotifyCustomKey,
  ObjectAppointmentScheduleLongReminderClass,
  ObjectAppointmentScheduleReminderClass,
  ObjectAppointmentScheduledClass,
  ObjectAssessmentSubmitAlertClass,
  ObjectBaseClass,
  ObjectChatMessageUserClass,
  ObjectCreateTodoClass,
  ObjectExternalContentMobileClass,
  ObjectExternalContentWebScheduleAppointmentClass,
  ObjectFutureNotifyClass,
  ObjectJournalContentClass,
  ObjectNewChatMessageToMemberClass,
  ObjectNewMemberClass,
  ObjectNewMemberNudgeClass,
  ObjectRegisterMemberWithTriggeredClass,
  ObjectUpdateSenderClientIdClass,
  Platform,
  RegisterInternalKey,
  TodoInternalKey,
  generateAppointmentScheduleLongReminderMock,
  generateAppointmentScheduleReminderMock,
  generateAppointmentScheduledMemberMock,
  generateAppointmentScheduledUserMock,
  generateAssessmentSubmitAlertMock,
  generateChatMessageUserMock,
  generateCreateTodoAPPTMock,
  generateCreateTodoMEDSMock,
  generateCreateTodoTODOMock,
  generateDeleteTodoAPPTMock,
  generateDeleteTodoMEDSMock,
  generateDeleteTodoTODOMock,
  generateExternalContentMobileMock,
  generateExternalContentWebScheduleAppointmentMock,
  generateNewChatMessageToMemberMock,
  generateNewControlMemberMock,
  generateNewMemberMock,
  generateNewMemberNudgeMock,
  generateObjectCallOrVideoMock,
  generateObjectCancelMock,
  generateObjectFutureNotifyMock,
  generateObjectJournalContentMock,
  generateObjectRegisterMemberWithTriggeredMock,
  generateRequestAppointmentMock,
  generateTextMessageUserMock,
  generateUpdateSenderClientIdMock,
  generateUpdateTodoAPPTMock,
  generateUpdateTodoMEDSMock,
  generateUpdateTodoTODOMock,
  mockLogger,
  mockProcessWarnings,
  translation,
} from '@argus/pandora';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { gapMinutes, hosts } from 'config';
import { addDays, addHours, subMinutes } from 'date-fns';
import { internet, lorem } from 'faker';
import { Model, Types } from 'mongoose';
import { SQSMessage } from 'sqs-consumer';
import { v4 } from 'uuid';
import { generateDispatch, replaceConfigs } from '../';
import { AppModule } from '../../src/app.module';
import { LoggerService } from '../../src/common';
import {
  Dispatch,
  DispatchStatus,
  DispatchesService,
  QueueService,
  TriggersService,
} from '../../src/conductor';
import {
  ConfigsService,
  Internationalization,
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
  let internationalization: Internationalization;
  let notificationsService: NotificationsService;
  let webMemberClient: ClientSettings;
  let mobileMemberClient: ClientSettings;
  let userClient: ClientSettings;
  let dispatchesModel: Model<Dispatch>;

  const providerResult: ProviderResult = {
    provider: Provider.twilio,
    content: lorem.sentence(),
    id: generateId(),
  };

  beforeAll(async () => {
    mockProcessWarnings(); // to hide pino prettyPrint warning
    module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    mockLogger(module.get<LoggerService>(LoggerService));
    service = module.get<QueueService>(QueueService);
    dispatchesService = module.get<DispatchesService>(DispatchesService);
    triggersService = module.get<TriggersService>(TriggersService);
    dispatchesModel = module.get<Model<Dispatch>>(getModelToken(Dispatch.name));

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
    internationalization = module.get<Internationalization>(Internationalization);
    await internationalization.onModuleInit();

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

  it('should delete client settings and all its related dispatches and triggers', async () => {
    const client1 = generateUpdateMemberSettingsMock({ platform: Platform.web });
    const message1: SQSMessage = {
      MessageId: v4(),
      Body: JSON.stringify({ type: InnerQueueTypes.updateClientSettings, ...client1 }),
    };
    await service.handleMessage(message1);

    const { objectNewMemberMock } = await generateNewMemberRequest(client1.id);
    const { objectAppointmentScheduleReminderType } =
      await generateAppointmentScheduleReminderRequest(client1.id);

    let dispatchNewMember = await dispatchesService.get(objectNewMemberMock.dispatchId);
    expect(dispatchNewMember).not.toBeNull();
    let dispatchAppointment = await dispatchesService.get(
      objectAppointmentScheduleReminderType.dispatchId,
    );
    expect(dispatchAppointment).not.toBeNull();
    let triggerAppointment = await triggersService.get(
      objectAppointmentScheduleReminderType.dispatchId,
    );
    expect(triggerAppointment).not.toBeNull();

    const deleteMessage: SQSMessage = {
      MessageId: v4(),
      Body: JSON.stringify({ type: InnerQueueTypes.deleteClientSettings, id: client1.id }),
    };
    await service.handleMessage(deleteMessage);

    dispatchNewMember = await dispatchesService.get(objectNewMemberMock.dispatchId);
    expect(dispatchNewMember).toBeNull();
    dispatchAppointment = await dispatchesService.get(
      objectAppointmentScheduleReminderType.dispatchId,
    );
    expect(dispatchAppointment).toBeNull();
    triggerAppointment = await triggersService.get(
      objectAppointmentScheduleReminderType.dispatchId,
    );
    expect(triggerAppointment).toBeNull();
  });

  it('should update sender client id', async () => {
    //creating new sender and recipient client
    const senderClient = generateUpdateUserSettingsMock();
    const messageSenderClient: SQSMessage = {
      MessageId: v4(),
      Body: JSON.stringify({ type: InnerQueueTypes.updateClientSettings, ...senderClient }),
    };
    await service.handleMessage(messageSenderClient);

    const recipientClient = generateUpdateMemberSettingsMock({ platform: Platform.web });
    const messageRecipientClient: SQSMessage = {
      MessageId: v4(),
      Body: JSON.stringify({ type: InnerQueueTypes.updateClientSettings, ...recipientClient }),
    };
    await service.handleMessage(messageRecipientClient);

    //generating a future dispatch
    await dispatchesService.update(
      generateDispatch({
        recipientClientId: recipientClient.id,
        senderClientId: senderClient.id,
        triggersAt: addHours(new Date(), 1),
        status: DispatchStatus.received,
      }),
    );

    //updating senderClientId to existing dispatch
    const newSenderClient = generateUpdateUserSettingsMock();
    const messageNewSenderClient: SQSMessage = {
      MessageId: v4(),
      Body: JSON.stringify({ type: InnerQueueTypes.updateClientSettings, ...newSenderClient }),
    };
    await service.handleMessage(messageNewSenderClient);

    const updateMock = generateUpdateSenderClientIdMock({
      recipientClientId: recipientClient.id,
      senderClientId: newSenderClient.id,
    });
    const objectSenderClientIdObject = new ObjectUpdateSenderClientIdClass(updateMock);
    const updateMessage: SQSMessage = {
      MessageId: v4(),
      Body: JSON.stringify({
        type: InnerQueueTypes.updateSenderClientId,
        ...objectSenderClientIdObject.updateSenderClientIdType,
      }),
    };
    await service.handleMessage(updateMessage);

    //check sender was changed
    const results = await dispatchesModel.find({ recipientClientId: recipientClient.id });
    expect(results[0].senderClientId).toEqual(newSenderClient.id);
  });

  it(`should handle 'immediate' event of type ${RegisterInternalKey.newMember}`, async () => {
    const object = await generateNewMemberRequest(webMemberClient.id);

    const body = replaceConfigs({
      content: translation.contents[RegisterInternalKey.newMember],
      memberClient: webMemberClient,
      userClient,
      appointmentId: object.objectNewMemberMock.appointmentId,
    });
    expect(spyOnTwilioSend).toBeCalledWith(
      {
        body,
        orgName: webMemberClient.orgName,
        to: webMemberClient.phone,
      },
      expect.any(String),
    );

    await compareResults({
      dispatchId: object.objectNewMemberMock.dispatchId,
      status: DispatchStatus.done,
      response: { ...object.objectNewMemberMock },
    });
  });

  // eslint-disable-next-line max-len
  it(`should handle 'immediate' event of type ${RegisterInternalKey.newControlMember}`, async () => {
    const object = new ObjectBaseClass(
      generateNewControlMemberMock({ recipientClientId: webMemberClient.id }),
    );
    spyOnTwilioSend.mockReturnValueOnce(providerResult);

    const message: SQSMessage = {
      MessageId: v4(),
      Body: JSON.stringify({ type: InnerQueueTypes.createDispatch, ...object.objectBaseType }),
    };
    await service.handleMessage(message);

    expect(spyOnTwilioSend).toBeCalledWith(
      {
        body: translation.contents[RegisterInternalKey.newControlMember],
        orgName: webMemberClient.orgName,
        to: webMemberClient.phone,
      },
      expect.any(String),
    );

    await compareResults({
      dispatchId: object.objectBaseType.dispatchId,
      status: DispatchStatus.done,
      response: { ...object.objectBaseType },
    });
  });

  it(`should handle 'future' event of type ${RegisterInternalKey.newMemberNudge}`, async () => {
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
    RegisterInternalKey.newRegisteredMember,
    RegisterInternalKey.newRegisteredMemberNudge,
    LogInternalKey.logReminder,
  ])(
    // eslint-disable-next-line max-len
    `should handle 'future' event of type %p(faking it to trigger now) and send to sendbird and twilio on ${NotificationType.textSms}`,
    async (contentKey) => {
      const mock = generateObjectRegisterMemberWithTriggeredMock({
        recipientClientId: webMemberClient.id,
        senderClientId: userClient.id,
        contentKey,
        notificationType: NotificationType.text,
        triggersAt: new Date(),
      });

      const object = new ObjectRegisterMemberWithTriggeredClass(mock);
      spyOnTwilioSend.mockReturnValueOnce(providerResult);

      const message: SQSMessage = {
        MessageId: v4(),
        Body: JSON.stringify({
          type: InnerQueueTypes.createDispatch,
          ...object.objectRegisterMemberWithTriggeredType,
        }),
      };
      await service.handleMessage(message);

      const content =
        replaceConfigs({
          content: translation.contents[contentKey],
          memberClient: webMemberClient,
          userClient,
        }) + `\n${hosts.get('dynamicLink')}`;

      expect(spyOnTwilioSend).toBeCalledWith(
        {
          body: content,
          orgName: webMemberClient.orgName,
          to: webMemberClient.phone,
        },
        expect.any(String),
      );

      await compareResults({
        dispatchId: mock.dispatchId,
        status: DispatchStatus.done,
        response: { ...object.objectRegisterMemberWithTriggeredType },
        pResult: providerResult,
      });
    },
  );

  test.each([
    { contentKey: RegisterInternalKey.newRegisteredMember, amount: 1 },
    { contentKey: RegisterInternalKey.newRegisteredMemberNudge, amount: 2 },
    { contentKey: LogInternalKey.logReminder, amount: 3 },
  ])(`should handle 'future' event of type $contentKey`, async (params) => {
    const newWebMemberClient = generateUpdateMemberSettingsMock({ platform: Platform.web });
    const webMemberClientMessage: SQSMessage = {
      MessageId: v4(),
      Body: JSON.stringify({ type: InnerQueueTypes.updateClientSettings, ...newWebMemberClient }),
    };
    await service.handleMessage(webMemberClientMessage);

    const mock = generateObjectRegisterMemberWithTriggeredMock({
      recipientClientId: newWebMemberClient.id,
      senderClientId: userClient.id,
      contentKey: params.contentKey,
      notificationType: NotificationType.text,
      triggersAt: addDays(new Date(), params.amount),
    });

    const object = new ObjectRegisterMemberWithTriggeredClass(mock);

    const message: SQSMessage = {
      MessageId: v4(),
      Body: JSON.stringify({
        type: InnerQueueTypes.createDispatch,
        ...object.objectRegisterMemberWithTriggeredType,
      }),
    };
    await service.handleMessage(message);

    const trigger = await triggersService.get(
      object.objectRegisterMemberWithTriggeredType.dispatchId,
    );
    expect(trigger.expireAt).toEqual(object.objectRegisterMemberWithTriggeredType.triggersAt);

    const items = { ...object.objectRegisterMemberWithTriggeredType };
    delete items.type;
    const result = await dispatchesService.get(trigger.dispatchId);
    expect(result).toEqual({
      dispatchId: object.objectRegisterMemberWithTriggeredType.dispatchId,
      status: DispatchStatus.received,
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      triggeredId: trigger._id.toString(),
      ...items,
      retryCount: 0,
      failureReasons: [],
      deleted: false,
    });
  });

  // eslint-disable-next-line max-len
  it(`should handle 'future' event of type ${AppointmentInternalKey.appointmentReminder}`, async () => {
    const object = await generateAppointmentScheduleReminderRequest(webMemberClient.id);

    const trigger = await triggersService.get(
      object.objectAppointmentScheduleReminderType.dispatchId,
    );
    expect(trigger.expireAt).toEqual(object.objectAppointmentScheduleReminderType.triggersAt);
    await compareResults({
      dispatchId: object.objectAppointmentScheduleReminderType.dispatchId,
      status: DispatchStatus.received,
      response: { ...object.objectAppointmentScheduleReminderType },
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      triggeredId: trigger._id.toString(),
    });
  });

  // eslint-disable-next-line max-len
  it(`should handle 'future' event of type ${AppointmentInternalKey.appointmentLongReminder}`, async () => {
    const appointmentTime = addDays(new Date(), 3);
    const object = new ObjectAppointmentScheduleLongReminderClass(
      generateAppointmentScheduleLongReminderMock({
        recipientClientId: webMemberClient.id,
        senderClientId: userClient.id,
        appointmentId: generateId(),
        appointmentTime,
        triggersAt: subMinutes(appointmentTime, gapMinutes),
      }),
    );

    const message: SQSMessage = {
      MessageId: v4(),
      Body: JSON.stringify({
        type: InnerQueueTypes.createDispatch,
        ...object.objectAppointmentScheduleLongReminderType,
      }),
    };
    await service.handleMessage(message);

    const trigger = await triggersService.get(
      object.objectAppointmentScheduleLongReminderType.dispatchId,
    );
    expect(trigger.expireAt).toEqual(object.objectAppointmentScheduleLongReminderType.triggersAt);
    await compareResults({
      dispatchId: object.objectAppointmentScheduleLongReminderType.dispatchId,
      status: DispatchStatus.received,
      response: { ...object.objectAppointmentScheduleLongReminderType },
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      triggeredId: trigger._id.toString(),
    });
  });

  /* eslint-disable max-len */
  it(`should handle 'immediate' event of type ${AppointmentInternalKey.appointmentScheduledUser}`, async () => {
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
      content: translation.contents[AppointmentInternalKey.appointmentScheduledUser],
      memberClient: webMemberClient,
      userClient,
      appointmentTime: realAppointmentTime,
    });
    expect(spyOnTwilioSend).toBeCalledWith(
      { body, orgName: undefined, to: userClient.phone },
      expect.any(String),
    );

    await compareResults({
      dispatchId: mock.dispatchId,
      status: DispatchStatus.done,
      response: { ...object.objectAppointmentScheduledType },
    });
  });

  // eslint-disable-next-line max-len
  it(`should handle 'immediate' event of type ${AppointmentInternalKey.appointmentScheduledMember}`, async () => {
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
      content: translation.contents[AppointmentInternalKey.appointmentScheduledMember],
      memberClient: webMemberClient,
      userClient,
      appointmentTime: realAppointmentTime,
    });
    expect(spyOnTwilioSend).toBeCalledWith(
      {
        body,
        orgName: webMemberClient.orgName,
        to: webMemberClient.phone,
      },
      expect.any(String),
    );

    await compareResults({
      dispatchId: mock.dispatchId,
      status: DispatchStatus.done,
      response: { ...object.objectAppointmentScheduledType },
    });
  });

  // eslint-disable-next-line max-len
  it(`should handle 'immediate' event of type ${AppointmentInternalKey.appointmentRequest}`, async () => {
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

    const body = `${replaceConfigs({
      content: translation.contents[AppointmentInternalKey.appointmentRequest],
      memberClient: webMemberClient,
      userClient,
    })}:\n${mock.scheduleLink}`;

    expect(spyOnTwilioSend).toBeCalledWith(
      {
        body,
        orgName: webMemberClient.orgName,
        to: webMemberClient.phone,
      },
      expect.any(String),
    );

    await compareResults({
      dispatchId: mock.dispatchId,
      status: DispatchStatus.done,
      response: { ...mock },
    });
  });

  test.each([ChatInternalKey.newChatMessageFromMember, LogInternalKey.memberNotFeelingWellMessage])(
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
      expect(spyOnTwilioSend).toBeCalledWith(
        {
          body,
          orgName: undefined,
          to: userClient.phone,
        },
        expect.any(String),
      );

      await compareResults({
        dispatchId: mock.dispatchId,
        status: DispatchStatus.done,
        response: { ...object.objectBaseType },
      });
    },
  );

  // eslint-disable-next-line max-len
  it(`should handle 'immediate' event of type ${ChatInternalKey.newChatMessageFromUser}`, async () => {
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
      content: translation.contents[ChatInternalKey.newChatMessageFromUser],
      memberClient: webMemberClient,
      userClient,
    });
    expect(spyOnTwilioSend).toBeCalledWith(
      {
        body,
        orgName: webMemberClient.orgName,
        to: webMemberClient.phone,
      },
      expect.any(String),
    );

    await compareResults({
      dispatchId: mock.dispatchId,
      status: DispatchStatus.done,
      response: { ...object.objectNewChatMessageFromUserType },
    });
  });

  test.each([NotificationType.video, NotificationType.call])(
    `should handle 'immediate' event of type ${NotifyCustomKey.callOrVideo} (%p)`,
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

      expect(spyOnOneSignalSend).toBeCalledWith(
        {
          externalUserId: mobileMemberClient.externalUserId,
          platform: mobileMemberClient.platform,
          data: {
            user: { id: userClient.id, firstName: userClient.firstName, avatar: userClient.avatar },
            member: { phone: mobileMemberClient.phone },
            type: mock.notificationType,
            contentKey: mock.contentKey,
            contentCategory: Categories.notify,
            peerId: mock.peerId,
            isVideo: mock.notificationType === NotificationType.video,
            path: mock.path,
            extraData: JSON.stringify({ iceServers }),
            content: undefined,
          },
          orgName: mobileMemberClient.orgName,
        },
        expect.any(String),
      );

      await compareResults({
        dispatchId: mock.dispatchId,
        status: DispatchStatus.done,
        response: { ...mock },
        pResult: providerResultOS,
      });
    },
  );

  // eslint-disable-next-line max-len
  it(`should handle 'immediate' event of type ${NotifyCustomKey.customContent}(${NotificationType.chat})`, async () => {
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

    expect(spyOnSendBirdSend).toBeCalledWith(
      {
        message: mock.content,
        notificationType: NotificationType.chat,
        contentKey: mock.contentKey,
        contentCategory: Categories.notify,
        orgName: undefined,
        sendBirdChannelUrl: mock.sendBirdChannelUrl,
        userId: webMemberClient.id,
      },
      expect.any(String),
    );

    await compareResults({
      dispatchId: mock.dispatchId,
      status: DispatchStatus.done,
      response: { ...object.objectChatMessageUserType },
    });
  });

  // eslint-disable-next-line max-len
  it(`should handle 'immediate' event of type ${NotifyCustomKey.customContent}(${NotificationType.textSms})`, async () => {
    const mock = generateObjectFutureNotifyMock({
      recipientClientId: webMemberClient.id,
      senderClientId: userClient.id,
      content: lorem.sentence(),
      notificationType: NotificationType.textSms,
      //setting this to now in order to check that sendbird is called as well
      sendBirdChannelUrl: internet.url(),
      triggersAt: new Date(),
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

    const content = replaceConfigs({
      content: mock.content,
      memberClient: webMemberClient,
      userClient,
    });

    const sendbirdParams: SendSendBirdNotification = {
      message: content,
      notificationType: mock.notificationType,
      contentKey: mock.contentKey,
      contentCategory: Categories.notify,
      orgName: webMemberClient.orgName,
      sendBirdChannelUrl: mock.sendBirdChannelUrl,
      userId: userClient.id,
      appointmentId: undefined,
      journalImageDownloadLink: undefined,
      journalAudioDownloadLink: undefined,
    };
    expect(spyOnSendBirdSend).toBeCalledWith(sendbirdParams, expect.any(String));

    expect(spyOnTwilioSend).toBeCalledWith(
      {
        body: content,
        orgName: webMemberClient.orgName,
        to: webMemberClient.phone,
      },
      expect.any(String),
    );

    await compareResults({
      dispatchId: mock.dispatchId,
      status: DispatchStatus.done,
      response: { ...object.objectFutureNotifyType },
      pResult: providerResult,
    });
  });

  // eslint-disable-next-line max-len
  it(`should handle 'immediate' event of type ${AlertInternalKey.assessmentSubmitAlert}(${NotificationType.textSms})`, async () => {
    const mock = generateAssessmentSubmitAlertMock({
      recipientClientId: userClient.id,
      senderClientId: webMemberClient.id,
      assessmentId: v4(),
      assessmentName: lorem.word(),
      assessmentScore: lorem.word(),
    });

    const object = new ObjectAssessmentSubmitAlertClass(mock);
    spyOnTwilioSend.mockReturnValueOnce(providerResult);

    const message: SQSMessage = {
      MessageId: v4(),
      Body: JSON.stringify({
        type: InnerQueueTypes.createDispatch,
        ...object.objectAssessmentSubmitAlertMock,
      }),
    };
    await service.handleMessage(message);

    const content = replaceConfigs({
      content: translation.contents[mock.contentKey],
      memberClient: webMemberClient,
      userClient,
      assessmentName: mock.assessmentName,
      assessmentScore: mock.assessmentScore,
      senderInitials: webMemberClient.firstName[0] + webMemberClient.lastName[0],
    });

    expect(spyOnTwilioSend).toBeCalledWith(
      {
        body: content,
        orgName: undefined,
        to: userClient.phone,
      },
      expect.any(String),
    );

    await compareResults({
      dispatchId: mock.dispatchId,
      status: DispatchStatus.done,
      response: { ...object.objectAssessmentSubmitAlertMock },
      pResult: providerResult,
    });
  });

  it(`should handle 'immediate' event of type ${JournalCustomKey.journalContent}`, async () => {
    const mock = generateObjectJournalContentMock({
      recipientClientId: userClient.id,
      senderClientId: webMemberClient.id,
      content: lorem.word(),
      sendBirdChannelUrl: internet.url(),
      journalAudioDownloadLink: internet.url(),
      journalImageDownloadLink: internet.url(),
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

    expect(spyOnSendBirdSend).toBeCalledWith(
      {
        message: mock.content,
        notificationType: NotificationType.chat,
        contentKey: mock.contentKey,
        contentCategory: Categories.journal,
        orgName: undefined,
        userId: webMemberClient.id,
        sendBirdChannelUrl: mock.sendBirdChannelUrl,
        journalAudioDownloadLink: mock.journalAudioDownloadLink,
        journalImageDownloadLink: mock.journalImageDownloadLink,
      },
      expect.any(String),
    );

    await compareResults({
      dispatchId: mock.dispatchId,
      status: DispatchStatus.done,
      response: { ...object.objectCustomContentType },
    });
  });

  test.each([ExternalKey.addCaregiverDetails, ExternalKey.setCallPermissions])(
    `should handle 'immediate' event of type %p`,
    async (contentKey) => {
      const mock = generateExternalContentMobileMock({
        recipientClientId: mobileMemberClient.id,
        senderClientId: userClient.id,
        contentKey,
        path: lorem.word(),
      });
      const object = new ObjectExternalContentMobileClass(mock);

      const providerResultOS: ProviderResult = { provider: Provider.oneSignal, id: generateId() };
      spyOnOneSignalSend.mockReturnValueOnce(providerResultOS);

      const message: SQSMessage = {
        MessageId: v4(),
        Body: JSON.stringify({
          type: InnerQueueTypes.createDispatch,
          ...object.objectExternalContentMobileType,
        }),
      };
      await service.handleMessage(message);

      const content = replaceConfigs({
        content: translation.contents[contentKey],
        memberClient: mobileMemberClient,
        userClient,
      });

      expect(spyOnOneSignalSend).toBeCalledWith(
        {
          externalUserId: mobileMemberClient.externalUserId,
          platform: mobileMemberClient.platform,
          data: {
            user: { id: userClient.id, firstName: userClient.firstName, avatar: userClient.avatar },
            member: { phone: mobileMemberClient.phone },
            type: mock.notificationType,
            contentKey: mock.contentKey,
            contentCategory: Categories.external,
            isVideo: false,
            path: mock.path,
          },
          content,
          orgName: mobileMemberClient.orgName,
        },
        expect.any(String),
      );

      await compareResults({
        dispatchId: mock.dispatchId,
        status: DispatchStatus.done,
        response: { ...mock },
        pResult: providerResultOS,
      });
    },
  );

  it(`should handle 'immediate' event of type ${ExternalKey.scheduleAppointment}`, async () => {
    spyOnTwilioSend.mockReturnValueOnce(providerResult);
    const contentKey = ExternalKey.scheduleAppointment;
    const mock = generateExternalContentWebScheduleAppointmentMock({
      recipientClientId: webMemberClient.id,
      senderClientId: userClient.id,
      scheduleLink: internet.url(),
    });
    const object = new ObjectExternalContentWebScheduleAppointmentClass(mock);

    const message: SQSMessage = {
      MessageId: v4(),
      Body: JSON.stringify({
        type: InnerQueueTypes.createDispatch,
        ...object.objectExternalContentWebScheduleAppointmentType,
      }),
    };
    await service.handleMessage(message);

    const body = `${replaceConfigs({
      content: translation.contents[contentKey],
      memberClient: webMemberClient,
      userClient,
    })}:\n${mock.scheduleLink}`;

    expect(spyOnTwilioSend).toBeCalledWith(
      {
        body,
        to: webMemberClient.phone,
        orgName: webMemberClient.orgName,
      },
      expect.any(String),
    );

    await compareResults({
      dispatchId: mock.dispatchId,
      status: DispatchStatus.done,
      response: { ...mock },
    });
  });

  test.each(Object.values(CancelNotificationType))(
    `should handle 'immediate' event of type ${NotifyCustomKey.cancelNotify} %p`,
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

  it(`should handle 'immediate' event of type ${TodoInternalKey.createTodoMEDS}`, async () => {
    const mock = generateCreateTodoMEDSMock({
      recipientClientId: mobileMemberClient.id,
      senderClientId: userClient.id,
      todoId: generateId(),
    });

    await compareTodos(mock);
  });

  it(`should handle 'immediate' event of type ${TodoInternalKey.createTodoAPPT}`, async () => {
    const mock = generateCreateTodoAPPTMock({
      recipientClientId: mobileMemberClient.id,
      senderClientId: userClient.id,
      todoId: generateId(),
    });

    await compareTodos(mock);
  });

  it(`should handle 'immediate' event of type ${TodoInternalKey.createTodoTODO}`, async () => {
    const mock = generateCreateTodoTODOMock({
      recipientClientId: mobileMemberClient.id,
      senderClientId: userClient.id,
      todoId: generateId(),
    });

    await compareTodos(mock);
  });

  it(`should handle 'immediate' event of type ${TodoInternalKey.updateTodoMEDS}`, async () => {
    const mock = generateUpdateTodoMEDSMock({
      recipientClientId: mobileMemberClient.id,
      senderClientId: userClient.id,
      todoId: generateId(),
    });

    await compareTodos(mock);
  });

  it(`should handle 'immediate' event of type ${TodoInternalKey.updateTodoAPPT}`, async () => {
    const mock = generateUpdateTodoAPPTMock({
      recipientClientId: mobileMemberClient.id,
      senderClientId: userClient.id,
      todoId: generateId(),
    });

    await compareTodos(mock);
  });

  it(`should handle 'immediate' event of type ${TodoInternalKey.updateTodoTODO}`, async () => {
    const mock = generateUpdateTodoTODOMock({
      recipientClientId: mobileMemberClient.id,
      senderClientId: userClient.id,
      todoId: generateId(),
    });

    await compareTodos(mock);
  });

  it(`should handle 'immediate' event of type ${TodoInternalKey.deleteTodoMEDS}`, async () => {
    const mock = generateDeleteTodoMEDSMock({
      recipientClientId: mobileMemberClient.id,
      senderClientId: userClient.id,
      todoId: generateId(),
    });

    await compareTodos(mock);
  });

  it(`should handle 'immediate' event of type ${TodoInternalKey.deleteTodoAPPT}`, async () => {
    const mock = generateDeleteTodoAPPTMock({
      recipientClientId: mobileMemberClient.id,
      senderClientId: userClient.id,
      todoId: generateId(),
    });

    await compareTodos(mock);
  });

  it(`should handle 'immediate' event of type ${TodoInternalKey.deleteTodoTODO}`, async () => {
    const mock = generateDeleteTodoTODOMock({
      recipientClientId: mobileMemberClient.id,
      senderClientId: userClient.id,
      todoId: generateId(),
    });

    await compareTodos(mock);
  });

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
      isTodoNotificationsEnabled: true,
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
      deleted: false,
    });
  };

  const generateNewMemberRequest = async (
    recipientClientId: string,
  ): Promise<ObjectNewMemberClass> => {
    const object = new ObjectNewMemberClass(
      generateNewMemberMock({
        recipientClientId,
        senderClientId: userClient.id,
      }),
    );
    spyOnTwilioSend.mockReturnValueOnce(providerResult);
    const messageNewMember: SQSMessage = {
      MessageId: v4(),
      Body: JSON.stringify({ type: InnerQueueTypes.createDispatch, ...object.objectNewMemberMock }),
    };
    await service.handleMessage(messageNewMember);

    return object;
  };

  const generateAppointmentScheduleReminderRequest = async (
    recipientClientId: string,
  ): Promise<ObjectAppointmentScheduleReminderClass> => {
    const appointmentTime = addDays(new Date(), 3);
    const object = new ObjectAppointmentScheduleReminderClass(
      generateAppointmentScheduleReminderMock({
        recipientClientId,
        senderClientId: userClient.id,
        appointmentId: generateId(),
        appointmentTime,
        triggersAt: subMinutes(appointmentTime, gapMinutes),
        chatLink: internet.url(),
      }),
    );
    const message: SQSMessage = {
      MessageId: v4(),
      Body: JSON.stringify({
        type: InnerQueueTypes.createDispatch,
        ...object.objectAppointmentScheduleReminderType,
      }),
    };
    await service.handleMessage(message);

    return object;
  };

  const compareTodos = async (mock) => {
    const object = new ObjectCreateTodoClass(mock);

    const providerResultOS: ProviderResult = { provider: Provider.oneSignal, id: generateId() };
    spyOnOneSignalSend.mockReturnValueOnce(providerResultOS);

    const message: SQSMessage = {
      MessageId: v4(),
      Body: JSON.stringify({
        type: InnerQueueTypes.createDispatch,
        ...object.objectCreateTodoMock,
      }),
    };

    await service.handleMessage(message);

    const content = replaceConfigs({
      content: translation.contents[mock.contentKey.split('.')[0]][mock.contentKey.split('.')[1]],
      memberClient: mobileMemberClient,
      userClient,
    });

    expect(spyOnOneSignalSend).toBeCalledWith(
      {
        platform: mobileMemberClient.platform,
        externalUserId: mobileMemberClient.externalUserId,
        data: {
          user: { id: userClient.id, firstName: userClient.firstName, avatar: userClient.avatar },
          member: { phone: mobileMemberClient.phone },
          type: mock.notificationType,
          contentKey: mock.contentKey,
          contentCategory: Categories.todo,
          isVideo: false,
          path: 'todo',
        },
        content,
        orgName: mobileMemberClient.orgName,
      },
      expect.any(String),
    );

    await compareResults({
      dispatchId: mock.dispatchId,
      status: DispatchStatus.done,
      response: { ...mock },
      pResult: providerResultOS,
    });
  };
});
