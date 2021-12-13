import {
  ContentKey,
  InnerQueueTypes,
  ObjectNewMemberClass,
  generateNewMemberMock,
} from '@lagunahealth/pandora';
import { Test, TestingModule } from '@nestjs/testing';
import { lorem } from 'faker';
import { SQSMessage } from 'sqs-consumer';
import { v4 } from 'uuid';
import { AppModule } from '../../src/app.module';
import { DispatchStatus, DispatchesService, QueueService } from '../../src/conductor';
import {
  ConfigsService,
  InternationalizationService,
  Provider,
  ProviderResult,
  Twilio,
} from '../../src/providers';
import {
  generateId,
  generateUpdateMemberSettingsMock,
  generateUpdateUserSettingsMock,
} from '../generators';
import { hosts } from 'config';

describe('Notifications full flow', () => {
  let module: TestingModule;
  let service: QueueService;
  let dispatchesService: DispatchesService;
  let spyOnTwilioSend;
  let internationalizationService: InternationalizationService;

  beforeAll(async () => {
    module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    service = module.get<QueueService>(QueueService);
    dispatchesService = module.get<DispatchesService>(DispatchesService);

    const twilio = module.get<Twilio>(Twilio);
    spyOnTwilioSend = jest.spyOn(twilio, 'send');
    spyOnTwilioSend.mockReturnValue(undefined);

    const configsService = module.get<ConfigsService>(ConfigsService);
    jest.spyOn(configsService, 'getConfig').mockResolvedValue(lorem.word());

    internationalizationService = module.get<InternationalizationService>(
      InternationalizationService,
    );
    await internationalizationService.onModuleInit();
  });

  afterEach(() => {
    spyOnTwilioSend.mockReset();
  });

  afterAll(async () => {
    await module.close();
    spyOnTwilioSend.mockRestore();
  });

  it(`should handle event of type ${ContentKey.newMember}`, async () => {
    //generate 2 clients : one is member one is user
    const recipientClient = generateUpdateMemberSettingsMock();
    const recipientClientM: SQSMessage = {
      MessageId: v4(),
      Body: JSON.stringify({ type: InnerQueueTypes.updateClientSettings, ...recipientClient }),
    };
    await service.handleMessage(recipientClientM);

    const senderClient = generateUpdateUserSettingsMock();
    const senderClientM: SQSMessage = {
      MessageId: v4(),
      Body: JSON.stringify({ type: InnerQueueTypes.updateClientSettings, ...senderClient }),
    };
    await service.handleMessage(senderClientM);

    //create dispatch - newMember
    const mock = generateNewMemberMock({
      recipientClientId: recipientClient.id,
      senderClientId: senderClient.id,
    });
    const object = new ObjectNewMemberClass(mock);
    const providerResult: ProviderResult = {
      provider: Provider.twilio,
      content: lorem.sentence(),
      id: generateId(),
    };
    spyOnTwilioSend.mockReturnValueOnce(providerResult);

    const message: SQSMessage = {
      MessageId: v4(),
      Body: JSON.stringify({ type: InnerQueueTypes.createDispatch, ...object.objectNewMemberMock }),
    };
    await service.handleMessage(message);

    const honorific =
      recipientClient.honorific.charAt(0).toUpperCase() + recipientClient.honorific.slice(1);
    expect(spyOnTwilioSend).toBeCalledWith({
      body:
        `Hello ${honorific}. ${recipientClient.lastName}, I'm ` +
        `${senderClient.firstName} from Laguna Health. We partnered with ` +
        `${recipientClient.orgName} to provide you free post-hospital recovery support. ` +
        `Tap below to download the app and schedule the first check-in.\n` +
        `${hosts.app}/download/${object.objectNewMemberMock.appointmentId}`,
      // `https://dev.app.lagunahealth.com/download/65c1e8d2-b741-4796-af4c-b1e844958390`,
      orgName: recipientClient.orgName,
      to: recipientClient.phone,
    });

    const result = await dispatchesService.get(object.objectNewMemberMock.dispatchId);

    const response = { ...object.objectNewMemberMock };
    delete response.type;
    expect(result).toEqual({
      ...response,
      providerResult,
      failureReasons: [],
      retryCount: 0,
      status: DispatchStatus.done,
      sentAt: expect.any(Date),
    });
  }, 7000);
});
