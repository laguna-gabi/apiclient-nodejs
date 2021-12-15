import {
  ContentKey,
  InnerQueueTypes,
  ObjectNewMemberClass,
  generateNewMemberMock,
} from '@lagunahealth/pandora';
import { Test, TestingModule } from '@nestjs/testing';
import { hosts } from 'config';
import { lorem } from 'faker';
import { SQSMessage } from 'sqs-consumer';
import { v4 } from 'uuid';
import { translation } from '../../languages/en.json';
import { AppModule } from '../../src/app.module';
import { DispatchStatus, DispatchesService, QueueService } from '../../src/conductor';
import {
  ConfigsService,
  InternationalizationService,
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

    const { orgName } = recipientClient;
    const body = replaceConfigs(
      translation.contents.newMember,
      recipientClient,
      senderClient,
      object.objectNewMemberMock.appointmentId,
    );
    expect(spyOnTwilioSend).toBeCalledWith({ body, orgName, to: recipientClient.phone });

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

  const replaceConfigs = (
    content: string,
    recipientClient: ClientSettings,
    senderClient: ClientSettings,
    appointmentId: string,
  ): string => {
    return content
      .replace('{{member.honorific}}', translation.honorific[recipientClient.honorific])
      .replace('{{member.lastName}}', recipientClient.lastName)
      .replace('{{user.firstName}}', senderClient.firstName)
      .replace('{{org.name}}', recipientClient.orgName)
      .replace('{{downloadLink}}', `${hosts.app}/download/${appointmentId}`);
  };
});
