import {
  ContentKey,
  InnerQueueTypes,
  ObjectAppointmentScheduledClass,
  ObjectGeneralMemberTriggeredClass,
  ObjectNewMemberClass,
  ObjectNewMemberNudgeClass,
  Platform,
  generateAppointmentScheduledMemberMock,
  generateAppointmentScheduledUserMock,
  generateGeneralMemberTriggeredMock,
  generateNewMemberMock,
  generateNewMemberNudgeMock,
  generateRequestAppointmentMock,
} from '@lagunahealth/pandora';
import { Test, TestingModule } from '@nestjs/testing';
import { internet, lorem } from 'faker';
import { addDays } from 'date-fns';
import { SQSMessage } from 'sqs-consumer';
import { v4 } from 'uuid';
import { translation } from '../../languages/en.json';
import { AppModule } from '../../src/app.module';
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
  Provider,
  ProviderResult,
  Twilio,
} from '../../src/providers';
import { ClientSettings } from '../../src/settings';
import {
  generateId,
  generateUpdateMemberSettingsMock,
  generateUpdateUserSettingsMock,
} from '../generators';
import { Types } from 'mongoose';
import { replaceConfigs } from '../';

describe('Notifications full flow', () => {
  let module: TestingModule;
  let service: QueueService;
  let dispatchesService: DispatchesService;
  let triggersService: TriggersService;
  let spyOnTwilioSend;
  let internationalizationService: InternationalizationService;
  let notificationsService: NotificationsService;
  let webMemberClient: ClientSettings;
  let userClient: ClientSettings;

  const providerResult: ProviderResult = {
    provider: Provider.twilio,
    content: lorem.sentence(),
    id: generateId(),
  };

  beforeAll(async () => {
    module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    service = module.get<QueueService>(QueueService);
    dispatchesService = module.get<DispatchesService>(DispatchesService);
    triggersService = module.get<TriggersService>(TriggersService);

    const twilio = module.get<Twilio>(Twilio);
    spyOnTwilioSend = jest.spyOn(twilio, 'send');
    spyOnTwilioSend.mockReturnValue(undefined);

    const configsService = module.get<ConfigsService>(ConfigsService);
    jest.spyOn(configsService, 'getConfig').mockResolvedValue(lorem.word());

    notificationsService = module.get<NotificationsService>(NotificationsService);
    internationalizationService = module.get<InternationalizationService>(
      InternationalizationService,
    );
    await internationalizationService.onModuleInit();

    await initClients();
  });

  afterEach(() => {
    spyOnTwilioSend.mockReset();
  });

  afterAll(async () => {
    await module.close();
    spyOnTwilioSend.mockRestore();
  });

  it(`should handle event of type ${ContentKey.newMember}`, async () => {
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
      content: translation.contents[ContentKey.newMember],
      recipientClient: webMemberClient,
      senderClient: userClient,
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

  it(`should handle event of type ${ContentKey.newMemberNudge}`, async () => {
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
    { contentKey: ContentKey.newRegisteredMember, amount: 1 },
    { contentKey: ContentKey.newRegisteredMemberNudge, amount: 2 },
    { contentKey: ContentKey.logReminder, amount: 3 },
  ])(`should handle event of type $contentKey`, async (params) => {
    const object = new ObjectGeneralMemberTriggeredClass(
      generateGeneralMemberTriggeredMock({
        recipientClientId: webMemberClient.id,
        senderClientId: userClient.id,
        contentKey: params.contentKey,
        triggersAt: addDays(new Date(), params.amount),
      }),
    );

    const message: SQSMessage = {
      MessageId: v4(),
      Body: JSON.stringify({
        type: InnerQueueTypes.createDispatch,
        ...object.objectGeneralMemberTriggeredMock,
      }),
    };
    await service.handleMessage(message);

    const trigger = await triggersService.get(object.objectGeneralMemberTriggeredMock.dispatchId);
    expect(trigger.expireAt).toEqual(object.objectGeneralMemberTriggeredMock.triggersAt);
    await compareResults({
      dispatchId: object.objectGeneralMemberTriggeredMock.dispatchId,
      status: DispatchStatus.received,
      response: { ...object.objectGeneralMemberTriggeredMock },
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      triggeredId: trigger._id.toString(),
    });
  });

  it(`should handle event of type ${ContentKey.appointmentScheduledUser}`, async () => {
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
      mock.notificationType,
      undefined,
      mock.appointmentTime,
    );
    const body = replaceConfigs({
      content: translation.contents[ContentKey.appointmentScheduledUser],
      recipientClient: userClient,
      senderClient: webMemberClient,
      appointmentTime: realAppointmentTime,
    });
    expect(spyOnTwilioSend).toBeCalledWith({ body, orgName: undefined, to: userClient.phone });

    await compareResults({
      dispatchId: mock.dispatchId,
      status: DispatchStatus.done,
      response: { ...object.objectAppointmentScheduledType },
    });
  });

  it(`should handle event of type ${ContentKey.appointmentScheduledMember}`, async () => {
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
      mock.notificationType,
      webMemberClient.zipCode,
      mock.appointmentTime,
    );
    const body = replaceConfigs({
      content: translation.contents[ContentKey.appointmentScheduledMember],
      recipientClient: webMemberClient,
      senderClient: userClient,
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

  it(`should handle event of type ${ContentKey.appointmentRequest}`, async () => {
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
      content: translation.contents[ContentKey.appointmentRequest],
      recipientClient: webMemberClient,
      senderClient: userClient,
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
  }, 7000);

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
  }: {
    dispatchId: string;
    status: DispatchStatus;
    response;
    triggeredId?;
  }) => {
    const result = await dispatchesService.get(dispatchId);
    delete response.type;

    const providerResultObject = status === DispatchStatus.done ? { providerResult } : {};
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
