import { ConfigsService, NotificationsService } from '../../src/providers';
import { HttpService } from '@nestjs/axios';
import { v4 } from 'uuid';
import { MobilePlatform, NotificationType } from '../../src/common';
import * as faker from 'faker';
import { delay } from '../common';

describe('live: notifications (one signal)', () => {
  it('should register a device on voip onesignal project and send video notification', async () => {
    const configService = new ConfigsService();
    const httpService = new HttpService();
    const notificationsService = new NotificationsService(configService, httpService);

    const params = { token: 'sampleiospushkittoken', externalUserId: v4() };
    const result = await notificationsService.register(params);
    expect(result).toBeTruthy();

    /**
     * one signal send notification causing an error if sent immediatly after registering a device.
     * So, we'll delay the send for 5 seconds(less than that sometimes doesn't work)
     * result.data.errors: ["All included players are not subscribed"]
     */
    await delay(5000);

    const sendResult = await notificationsService.send({
      externalUserId: params.externalUserId,
      mobilePlatform: MobilePlatform.ios,
      notificationType: NotificationType.voip,
      payload: { contents: { en: faker.lorem.sentence() }, heading: { en: faker.lorem.word() } },
    });
    expect(sendResult).toBeTruthy();
  }, 10000);
});
