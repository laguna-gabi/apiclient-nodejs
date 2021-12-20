import {
  CancelNotificationType,
  NotificationType,
  Platform,
  generatePhone,
} from '@lagunahealth/pandora';
import { Test, TestingModule } from '@nestjs/testing';
import * as faker from 'faker';
import { v4 } from 'uuid';
import { ErrorType, Errors, LoggerService, delay } from '../../src/common';
import { NotificationsService } from '../../src/providers';
import { dbDisconnect, defaultModules, mockLogger } from '../common';
import { generatePath } from '../generators';

/**
 * THIS TEST IS DISABLED
 */
describe.skip('live: notifications (one signal)', () => {
  const delayTime = 25000;

  const beforeEachCustom = async () => {
    const module = await Test.createTestingModule({ imports: defaultModules() }).compile();
    mockLogger(module.get<LoggerService>(LoggerService));

    const notificationsService = module.get<NotificationsService>(NotificationsService);

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    await notificationsService.oneSignal.onModuleInit();

    return { module, notificationsService };
  };

  const afterEachCustom = async (module: TestingModule) => {
    await module.close();
  };

  afterAll(async () => {
    await dbDisconnect();
  });

  it.concurrent(
    'should register an ios device on voip onesignal project and send video notification',
    async () => {
      const { notificationsService, module } = await beforeEachCustom();
      const params = {
        notificationsService,
        token: 'sampleiospushkittoken1',
        externalUserId: v4(),
        platform: Platform.ios,
        isPushNotificationsEnabled: true,
      };
      const playerId = await notificationsService.register(params);
      expect(playerId).not.toBeUndefined();

      await sendNotification(params);
      await afterEachCustom(module);
    },
    delayTime + 5000,
  );

  it.concurrent(
    'should send video notification and then cancel it',
    async () => {
      const { notificationsService, module } = await beforeEachCustom();
      const params = {
        notificationsService,
        token: 'sampleiospushkittoken2',
        externalUserId: v4(),
        platform: Platform.ios,
        isPushNotificationsEnabled: true,
      };
      const playerId = await notificationsService.register(params);
      expect(playerId).not.toBeUndefined();

      const result = await sendNotification(params);

      /* Delay so the notification has time to reach the target*/
      await delay(1000);

      await notificationsService.cancel({
        externalUserId: params.externalUserId,
        platform: params.platform,
        data: {
          peerId: v4(),
          type: CancelNotificationType.cancelVideo,
          notificationId: result,
        },
      });
      await afterEachCustom(module);
    },
    delayTime + 6000,
  );

  it.concurrent('should throw an error for not existing notificationId', async () => {
    const { notificationsService, module } = await beforeEachCustom();
    const params = {
      notificationsService,
      token: 'sampleiospushkittoken3',
      externalUserId: v4(),
      platform: Platform.ios,
      isPushNotificationsEnabled: true,
    };
    const playerId = await notificationsService.register(params);
    expect(playerId).not.toBeUndefined();

    await expect(
      notificationsService.cancel({
        externalUserId: params.externalUserId,
        platform: params.platform,
        data: {
          peerId: v4(),
          type: CancelNotificationType.cancelVideo,
          notificationId: v4(),
        },
      }),
    ).rejects.toThrow(Errors.get(ErrorType.notificationNotFound));
    await afterEachCustom(module);
  });

  /* eslint-disable max-len */
  /**
   * This is only optional when loading the app on android emulator, since the externalUserId
   * needs to be subscribed on onesignal.
   * https://app.onesignal.com/apps/02126dc4-664e-4acb-bc42-cb6edc100993/players?user_search%5Bby%5D=external_id&user_search%5Bterm%5D=eb0ef495-0e63-4a48-b45a-a58248f6b775
   * We're setting this as skip since once the emulator is shutdown the state of the user in
   * one signal is 'un-subscribed' which will cause the `send` api to return 400 http response.
   */
  /* eslint-enable max-len */
  it.concurrent.skip(
    'should send android video notification for default onesignal project',
    async () => {
      const { notificationsService, module } = await beforeEachCustom();
      const params = {
        externalUserId: 'eb0ef495-0e63-4a48-b45a-a58248f6b775',
        platform: Platform.android,
        isPushNotificationsEnabled: true,
      };

      const result = await notificationsService.send({
        sendOneSignalNotification: {
          platform: params.platform,
          externalUserId: params.externalUserId,
          data: {
            user: {
              id: faker.datatype.uuid(),
              firstName: faker.name.firstName(),
              avatar: faker.image.avatar(),
            },
            member: {
              phone: generatePhone(),
            },
            type: NotificationType.call,
            peerId: v4(),
            isVideo: false,
            ...generatePath(NotificationType.call),
          },
        },
      });

      expect(result).toBeTruthy();
      await afterEachCustom(module);
    },
  );

  /************************************************************************************************
   *************************************** Internal methods ***************************************
   ***********************************************************************************************/

  const sendNotification = async (params: {
    notificationsService: NotificationsService;
    token: string;
    externalUserId: string;
    platform: Platform;
    isPushNotificationsEnabled: boolean;
  }): Promise<string> => {
    /**
     * If sent immediately after registering a device, calling send notification causes an error.
     * We'll retry and delay sending a notification for a few seconds.
     * result.data.errors: ["All included players are not subscribed"]
     */
    await delay(delayTime);

    const result = await params.notificationsService.send({
      sendOneSignalNotification: {
        platform: params.platform,
        externalUserId: params.externalUserId,
        data: {
          user: {
            id: faker.datatype.uuid(),
            firstName: faker.name.firstName(),
            avatar: faker.image.avatar(),
          },
          member: {
            phone: generatePhone(),
          },
          type: NotificationType.call,
          peerId: v4(),
          isVideo: false,
          ...generatePath(NotificationType.call),
        },
      },
    });

    if (result) {
      expect(result).toMatch(
        /\b[0-9a-f]{8}\b-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-\b[0-9a-f]{12}\b/,
      );
      return result;
    }
  };
});
