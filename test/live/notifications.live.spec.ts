import { NotificationsService } from '../../src/providers';
import { v4 } from 'uuid';
import {
  CancelNotificationType,
  Errors,
  ErrorType,
  NotificationType,
  Platform,
} from '../../src/common';
import * as faker from 'faker';
import { dbDisconnect, defaultModules, delay } from '../common';
import { generatePath, generatePhone } from '../generators';
import { Test, TestingModule } from '@nestjs/testing';

/**
 * one signal is very unstable, disabling this test, open only for internal debugging
 */
describe.skip('live: notifications (one signal)', () => {
  const delayTime = 5000;
  const RETRY_MAX = 5;

  let module: TestingModule;
  let notificationsService: NotificationsService;

  beforeAll(async () => {
    module = await Test.createTestingModule({ imports: defaultModules() }).compile();
    notificationsService = module.get<NotificationsService>(NotificationsService);
  });

  afterAll(async () => {
    await module.close();
    await dbDisconnect();
  });

  it(
    'should register an ios device on voip onesignal project and send video notification',
    async () => {
      const params = {
        token: 'sampleiospushkittoken',
        externalUserId: v4(),
        platform: Platform.ios,
        isPushNotificationsEnabled: true,
      };
      const playerId = await notificationsService.register(params);
      expect(playerId).not.toBeUndefined();

      await sendNotification(params);
    },
    delayTime * RETRY_MAX + 5000,
  );

  it(
    'should send video notification and then cancel it',
    async () => {
      const params = {
        token: 'sampleioscancelkittoken',
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
        isPushNotificationsEnabled: params.isPushNotificationsEnabled,
        data: {
          peerId: v4(),
          type: CancelNotificationType.cancelVideo,
          notificationId: result,
        },
      });
    },
    delayTime * RETRY_MAX + 6000,
  );

  it('should throw an error for not existing notificationId', async () => {
    const params = {
      token: 'sampleioscancelkittoken',
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
        isPushNotificationsEnabled: params.isPushNotificationsEnabled,
        data: {
          peerId: v4(),
          type: CancelNotificationType.cancelVideo,
          notificationId: v4(),
        },
      }),
    ).rejects.toThrow(Errors.get(ErrorType.notificationNotFound));
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
  it.skip('should send android video notification for default onesignal project', async () => {
    const params = {
      externalUserId: 'eb0ef495-0e63-4a48-b45a-a58248f6b775',
      platform: Platform.android,
      isPushNotificationsEnabled: true,
    };

    const result = await notificationsService.send({
      sendNotificationToMemberParams: {
        externalUserId: params.externalUserId,
        platform: params.platform,
        isPushNotificationsEnabled: params.isPushNotificationsEnabled,
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
        metadata: undefined,
      },
    });

    expect(result).toBeTruthy();
  });

  /************************************************************************************************
   *************************************** Internal methods ***************************************
   ***********************************************************************************************/

  const sendNotification = async (params: {
    token: string;
    externalUserId: string;
    platform: Platform;
    isPushNotificationsEnabled: boolean;
  }) => {
    let result;
    let current = 0;

    /**
     * If sent immediately after registering a device, calling send notification causes an error.
     * We'll retry and delay sending a notification for a few seconds.
     * result.data.errors: ["All included players are not subscribed"]
     */
    while (current < RETRY_MAX) {
      await delay(delayTime);

      result = await notificationsService.send({
        sendNotificationToMemberParams: {
          externalUserId: params.externalUserId,
          platform: params.platform,
          isPushNotificationsEnabled: params.isPushNotificationsEnabled,
          data: {
            user: {
              id: v4(),
              firstName: faker.name.firstName(),
              avatar: faker.image.avatar(),
            },
            member: {
              phone: generatePhone(),
            },
            type: NotificationType.video,
            peerId: v4(),
            isVideo: true,
            path: 'call',
          },
          metadata: { peerId: v4(), content: 'test' },
        },
      });

      current = result ? RETRY_MAX : current + 1;
      if (current === RETRY_MAX || result) {
        expect(result).toMatch(
          /\b[0-9a-f]{8}\b-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-\b[0-9a-f]{12}\b/,
        );
        return result;
      }
    }
  };
});
