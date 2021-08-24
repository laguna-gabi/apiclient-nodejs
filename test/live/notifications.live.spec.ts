import { ConfigsService, NotificationsService } from '../../src/providers';
import { HttpService } from '@nestjs/axios';
import { v4 } from 'uuid';
import { MobilePlatform, NotificationType } from '../../src/common';
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
    'should register a device on voip onesignal project and send video notification',
    async () => {
      const params = { token: 'sampleiospushkittoken', externalUserId: v4() };
      const result = await notificationsService.register(params);
      expect(result).toBeTruthy();

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
          mobilePlatform: MobilePlatform.ios,
          notificationType: NotificationType.voip,
          payload: {
            contents: { en: faker.lorem.sentence() },
            heading: { en: faker.lorem.word() },
          },
        });

        current = result ? RETRY_MAX : current + 1;
        if (current === RETRY_MAX || result) {
          expect(result).toBeTruthy();
        }
      }
    },
    delayTime * RETRY_MAX + 5000,
  );
});
