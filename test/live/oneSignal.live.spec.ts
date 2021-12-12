import {
  BaseLogger,
  CancelNotificationType,
  NotificationType,
  Platform,
  ServiceName,
} from '@lagunahealth/pandora';
import { HttpService } from '@nestjs/axios';
import * as faker from 'faker';
import { v4 } from 'uuid';
import { ErrorType, Errors } from '../../src/common';
import { ConfigsService, OneSignal } from '../../src/providers';
import { generatePath, generatePhone } from '../generators';

describe(`live: ${OneSignal.name}`, () => {
  let oneSignal: OneSignal;

  beforeAll(async () => {
    const configService = new ConfigsService();
    const httpService = new HttpService();

    oneSignal = new OneSignal(configService, httpService, new BaseLogger(ServiceName.iris, []));
    await oneSignal.onModuleInit();
  });

  /**
   * The device is not subscribed, so we're only testing here the functionality of calling the api
   */
  it('should send video notification and cancel it', async () => {
    const params = {
      token: faker.lorem.word(),
      externalUserId: v4(),
      platform: Platform.ios,
      isPushNotificationsEnabled: true,
    };

    await oneSignal.send({
      platform: params.platform,
      externalUserId: params.externalUserId,
      data: {
        user: {
          id: faker.datatype.uuid(),
          firstName: faker.name.firstName(),
          avatar: faker.image.avatar(),
        },
        member: { phone: generatePhone() },
        type: NotificationType.call,
        peerId: v4(),
        isVideo: false,
        ...generatePath(NotificationType.call),
      },
    });

    await expect(
      oneSignal.cancel({
        externalUserId: params.externalUserId,
        platform: params.platform,
        data: {
          peerId: v4(),
          type: CancelNotificationType.cancelVideo,
          notificationId: faker.datatype.uuid(),
        },
      }),
    ).rejects.toThrow(Errors.get(ErrorType.notificationNotFound));
  });
});
