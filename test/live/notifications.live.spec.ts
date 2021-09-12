import { ConfigsService, NotificationsService } from '../../src/providers';
import { HttpService } from '@nestjs/axios';
import { v4 } from 'uuid';
import { Platform, NotificationType } from '../../src/common';
import * as faker from 'faker';
import { delay } from '../common';

describe('live: notifications (one signal)', () => {
  let notificationsService: NotificationsService;
  const delayTime = 3000;
  const RETRY_MAX = 3;

  beforeAll(() => {
    const configService = new ConfigsService();
    const httpService = new HttpService();
    notificationsService = new NotificationsService(configService, httpService);
  });

  it(
    'should register an ios device on voip onesignal project and send video notification',
    async () => {
      const params = {
        token: 'sampleiospushkittoken',
        externalUserId: v4(),
        platform: Platform.ios,
      };
      const playerId = await notificationsService.register(params);
      expect(playerId).not.toBeUndefined();

      /**
       * If sent immediately after registering a device, calling send notification causes an error.
       * We'll retry and delay sending a notification for a few seconds.
       * result.data.errors: ["All included players are not subscribed"]
       */
      let current = 0;
      while (current < RETRY_MAX) {
        await delay(delayTime);

        const result = await notificationsService.send({
          externalUserId: params.externalUserId,
          platform: params.platform,
          payload: {
            heading: { en: faker.lorem.word() },
          },
          data: {
            user: {
              id: v4(),
              firstName: faker.name.firstName(),
              avatar: faker.image.avatar(),
            },
            type: NotificationType.video,
            peerId: v4(),
            isVideo: true,
            path: 'call',
          },
        });

        current = result ? RETRY_MAX : current + 1;
        if (current === RETRY_MAX || result) {
          expect(result).toBeTruthy();
        }
      }
      await notificationsService.unregister(playerId, params.platform);
    },
    delayTime * RETRY_MAX + 5000,
  );

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
    };

    const result = await notificationsService.send({
      externalUserId: params.externalUserId,
      platform: params.platform,
      payload: {
        contents: { en: faker.lorem.sentence() },
        heading: { en: faker.lorem.word() },
      },
      data: {
        user: {
          id: faker.datatype.uuid(),
          firstName: faker.name.firstName(),
          avatar: faker.image.avatar(),
        },
        type: NotificationType.call,
        peerId: v4(),
        isVideo: false,
        path: 'call',
      },
    });

    expect(result).toBeTruthy();
  });
});
