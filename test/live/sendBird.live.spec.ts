import { InternalNotificationType, mockLogger } from '@lagunahealth/pandora';
import { HttpService } from '@nestjs/axios';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as AWS from 'aws-sdk';
import { aws } from 'config';
import * as faker from 'faker';
import { existsSync, unlinkSync } from 'fs';
import { PARAMS_PROVIDER_TOKEN, Params } from 'nestjs-pino';
import { Environments, Logger } from '../../src/common';
import {
  ConfigsService,
  ExternalConfigs,
  Provider,
  ProviderResult,
  RequestType,
  SendBird,
  SendSendBirdNotification,
} from '../../src/providers';

describe(`live: ${SendBird.name}`, () => {
  let basePath;
  let headers;
  let sendBird: SendBird;
  const sendBirdChannelUrl =
    'sendbird_group_channel_141220520_b400c9d50c2e959d882690886bdc9c2d5758adba';
  const journalAudioDownloadLink =
    'https://file-examples-com.github.io/uploads/2017/11/file_example_MP3_700KB.mp3';
  const journalImageDownloadLink =
    'https://file-examples-com.github.io/uploads/2017/10/file_example_PNG_500kB.png';
  const userId = 'test1';

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

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    sendBird.basePath = basePath;
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    sendBird.headers = headers;
  });

  afterAll(async () => {
    const files = [`./${userId}.mp3`, `./${userId}.png`];
    await Promise.all(
      files.map((fileName) => {
        if (existsSync(fileName)) {
          unlinkSync(fileName);
        }
      }),
    );
  });

  it('should send admin message', async () => {
    const params: SendSendBirdNotification = {
      userId,
      sendBirdChannelUrl,
      message: faker.lorem.word(),
      notificationType: InternalNotificationType.chatMessageToUser,
    };
    await checkResult('admin', params);
  });

  it('should send journal text message', async () => {
    const params: SendSendBirdNotification = {
      userId,
      sendBirdChannelUrl,
      message: faker.lorem.word(),
      notificationType: InternalNotificationType.chatMessageJournal,
    };
    await checkResult('journalText', params);
  });

  it('should send journal image message', async () => {
    const params: SendSendBirdNotification = {
      userId,
      sendBirdChannelUrl,
      message: faker.lorem.word(),
      notificationType: InternalNotificationType.chatMessageJournal,
      journalImageDownloadLink,
    };
    await checkResult('journalImage', params);
  });

  it('should send journal text message with audio', async () => {
    const params: SendSendBirdNotification = {
      userId,
      sendBirdChannelUrl,
      message: faker.lorem.word(),
      notificationType: InternalNotificationType.chatMessageJournal,
      journalAudioDownloadLink,
    };
    const result = await sendBird.send(params);

    expect(result).toEqual({
      provider: Provider.sendbird,
      content: `journalText: ${params.message}, journalAudio: ${params.message}`,
      id: expect.stringContaining(`journalTextId`) && expect.stringContaining(`journalAudioId`),
    });
  });

  it('should send journal image message with audio', async () => {
    const params: SendSendBirdNotification = {
      userId,
      sendBirdChannelUrl,
      message: faker.lorem.word(),
      notificationType: InternalNotificationType.chatMessageJournal,
      journalAudioDownloadLink,
      journalImageDownloadLink,
    };
    const result = await sendBird.send(params);

    expect(result).toEqual({
      provider: Provider.sendbird,
      content: `journalImage: ${params.message}, journalAudio: ${params.message}`,
      id: expect.stringContaining(`journalImageId`) && expect.stringContaining(`journalAudioId`),
    });
  });

  async function checkResult(requestType: RequestType, params: SendSendBirdNotification) {
    const result: ProviderResult = await sendBird.send(params);
    expect(result).toEqual({
      provider: Provider.sendbird,
      content: `${requestType}: ${params.message}`,
      id: expect.stringContaining(`${requestType}Id:`),
    });
  }
});
