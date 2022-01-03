import { InternalNotificationType, mockLogger } from '@lagunahealth/pandora';
import { HttpService } from '@nestjs/axios';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as AWS from 'aws-sdk';
import { aws } from 'config';
import * as faker from 'faker';
import { PARAMS_PROVIDER_TOKEN, Params } from 'nestjs-pino';
import { Environments, Logger } from '../../src/common';
import {
  ConfigsService,
  ExternalConfigs,
  SendBird,
  SendSendBirdNotification,
} from '../../src/providers';

describe(`live: ${SendBird.name}`, () => {
  let basePath;
  let headers;
  let sendBird;
  const sendBirdChannelUrl =
    'sendbird_group_channel_141220520_b400c9d50c2e959d882690886bdc9c2d5758adba';
  let spyOnSendBirdSendJournalText;
  let spyOnSendBirdSendJournalImage;
  let spyOnSendBirdSendJournalAudio;
  let spyOnSendBirdSendAdminMessage;

  beforeAll(async () => {
    const secretsManager = new AWS.SecretsManager({ region: aws.region });
    const result = await secretsManager
      .getSecretValue({
        SecretId: Environments.test,
      })
      .promise();
    const data = JSON.parse(result.SecretString);

    const appId = data[ExternalConfigs.sendbird.apiId];
    const appToken = data[ExternalConfigs.sendbird.apiToken];

    basePath = `https://api-${appId}.sendbird.com/v3/`;
    headers = { 'Api-Token': appToken };

    const configService = new ConfigsService();
    const httpService = new HttpService();
    const logger = new Logger(PARAMS_PROVIDER_TOKEN as Params, new EventEmitter2());
    mockLogger(logger);

    sendBird = new SendBird(
      configService,
      httpService,
      new Logger(PARAMS_PROVIDER_TOKEN as Params, new EventEmitter2()),
    );

    sendBird.basePath = basePath;
    sendBird.headers = headers;

    spyOnSendBirdSendAdminMessage = jest.spyOn(sendBird, 'sendAdminMessage');
    spyOnSendBirdSendJournalText = jest.spyOn(sendBird, 'sendJournalText');
    spyOnSendBirdSendJournalImage = jest.spyOn(sendBird, 'sendJournalImage');
    spyOnSendBirdSendJournalAudio = jest.spyOn(sendBird, 'sendJournalAudio');
  });

  it('should send admin message', async () => {
    const params: SendSendBirdNotification = {
      userId: 'test1',
      sendBirdChannelUrl,
      message: faker.lorem.word(),
      notificationType: InternalNotificationType.chatMessageToUser,
    };

    const result = await sendBird.send(params);

    expect(spyOnSendBirdSendAdminMessage).toBeCalled();
    expect(spyOnSendBirdSendAdminMessage).toBeCalled();
    expect(result).toEqual({
      provider: 'sendbird',
      content: params.message,
      id: expect.any(Number),
    });
  });

  it('should send journal text message', async () => {
    const params: SendSendBirdNotification = {
      userId: 'test1',
      sendBirdChannelUrl,
      message: faker.lorem.word(),
      notificationType: InternalNotificationType.chatMessageJournal,
    };

    const result = await sendBird.send(params);

    expect(spyOnSendBirdSendJournalText).toBeCalled();
    expect(result).toEqual({
      provider: 'sendbird',
      content: params.message,
      id: expect.any(Number),
    });
  });

  it('should send journal image message', async () => {
    const params: SendSendBirdNotification = {
      userId: 'test1',
      sendBirdChannelUrl,
      message: faker.lorem.word(),
      notificationType: InternalNotificationType.chatMessageJournal,
      journalImageDownloadLink:
        'https://file-examples-com.github.io/uploads/2017/10/file_example_PNG_500kB.png',
    };

    await sendBird.send(params);

    expect(spyOnSendBirdSendJournalImage).toBeCalled();
  });

  it('should send journal text message with audio', async () => {
    const params: SendSendBirdNotification = {
      userId: 'test1',
      sendBirdChannelUrl,
      message: faker.lorem.word(),
      notificationType: InternalNotificationType.chatMessageJournal,
      journalAudioDownloadLink:
        'https://file-examples-com.github.io/uploads/2017/11/file_example_MP3_700KB.mp3',
    };

    await sendBird.send(params);

    expect(spyOnSendBirdSendJournalText).toBeCalledTimes(2);
    expect(spyOnSendBirdSendJournalAudio).toBeCalled();
  });
});
