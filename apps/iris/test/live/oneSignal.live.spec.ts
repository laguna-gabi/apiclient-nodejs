import { Categories, NotifyCustomKey } from '@argus/irisClient';
import { CancelNotificationType, NotificationType, Platform, mockLogger } from '@argus/pandora';
import { HttpService } from '@nestjs/axios';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { datatype, image, lorem, name } from 'faker';
import { PARAMS_PROVIDER_TOKEN, Params } from 'nestjs-pino';
import { v4 } from 'uuid';
import { LoggerService } from '../../src/common';
import { ConfigsService, OneSignal } from '../../src/providers';
import { generatePath, generatePhone } from '../generators';

describe(`live: ${OneSignal.name}`, () => {
  let oneSignal: OneSignal;
  let logger: LoggerService;
  let spyOnLoggerWarn;

  beforeAll(async () => {
    const configService = new ConfigsService();
    const httpService = new HttpService();
    logger = new LoggerService(PARAMS_PROVIDER_TOKEN as Params, new EventEmitter2());
    mockLogger(logger);

    oneSignal = new OneSignal(configService, httpService, logger);
    await oneSignal.onModuleInit();
  });

  beforeEach(async () => {
    spyOnLoggerWarn = jest.spyOn(logger, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    spyOnLoggerWarn.mockReset();
  });

  /**
   * The device is not subscribed, so we're only testing here the functionality of calling the api
   */
  it('should send video notification and cancel it', async () => {
    const params = {
      token: lorem.word(),
      externalUserId: v4(),
      platform: Platform.ios,
      isPushNotificationsEnabled: true,
    };

    expect(
      await oneSignal.send(
        {
          platform: params.platform,
          externalUserId: params.externalUserId,
          data: {
            user: {
              id: datatype.uuid(),
              firstName: name.firstName(),
              avatar: image.avatar(),
            },
            member: { phone: generatePhone() },
            type: NotificationType.call,
            contentKey: NotifyCustomKey.callOrVideo,
            contentCategory: Categories.notify,
            peerId: v4(),
            isVideo: false,
            ...generatePath(NotificationType.call),
          },
        },
        v4(),
      ),
    ).toBeUndefined();

    expect(
      await oneSignal.cancel({
        externalUserId: params.externalUserId,
        platform: params.platform,
        data: {
          peerId: v4(),
          type: CancelNotificationType.cancelVideo,
          notificationId: datatype.uuid(),
        },
      }),
    ).toBeUndefined();
  });

  expect(spyOnLoggerWarn).toHaveBeenCalledTimes(2);
});
