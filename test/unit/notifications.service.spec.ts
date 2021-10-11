import { NotificationsService, TwilioService } from '../../src/providers';
import { v4 } from 'uuid';
import { NotificationType, Platform, SendNotificationToMemberParams } from '../../src/common';
import * as faker from 'faker';
import { generateId, generatePhone } from '../generators';
import { Test, TestingModule } from '@nestjs/testing';
import { dbDisconnect, defaultModules } from '../common';

describe('NotificationsService (offline)', () => {
  let module: TestingModule;
  let notificationsService: NotificationsService;
  let twilio: TwilioService;

  beforeAll(async () => {
    module = await Test.createTestingModule({ imports: defaultModules() }).compile();

    notificationsService = module.get<NotificationsService>(NotificationsService);
    twilio = module.get<TwilioService>(TwilioService);
  });

  afterAll(async () => {
    await module.close();
    await dbDisconnect();
  });

  /* eslint-disable max-len */
  test.each`
    text                                  | params
    ${'platform=web'}                     | ${{ platform: Platform.web, isPushNotificationsEnabled: true }}
    ${'isPushNotificationsEnabled=false'} | ${{ platform: Platform.ios, isPushNotificationsEnabled: false }}
  `(`should notify for twilio on $text`, async (params) => {
    /* eslint-enable max-len */
    const twilioMock = jest.spyOn(twilio, 'send');
    twilioMock.mockResolvedValue(true);

    const sendNotificationToMemberParams = generateSendNotificationToMemberParams(params.params);
    await notificationsService.send({ sendNotificationToMemberParams });

    expect(twilioMock).toBeCalledWith({
      body: sendNotificationToMemberParams.metadata.content,
      to: sendNotificationToMemberParams.data.member.phone,
    });
    twilioMock.mockReset();
  });

  test.each([Platform.ios, Platform.android])(
    'should not notify twilio on platform %p and isPushNotificationsEnabled=true',
    async (platform) => {
      const twilioMock = jest.spyOn(notificationsService, 'send');
      twilioMock.mockRestore();
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const spyOnOneSignal = jest.spyOn(notificationsService.oneSignal, 'send');
      spyOnOneSignal.mockResolvedValue(generateId());

      await notificationsService.send({
        sendNotificationToMemberParams: generateSendNotificationToMemberParams({ platform }),
      });

      expect(twilioMock).not.toBeCalled();
      expect(spyOnOneSignal).toBeCalledTimes(1);
      spyOnOneSignal.mockReset();
    },
  );

  const generateSendNotificationToMemberParams = ({
    platform,
    isPushNotificationsEnabled = true,
  }: {
    platform: Platform;
    isPushNotificationsEnabled?: boolean;
  }): SendNotificationToMemberParams => {
    return {
      externalUserId: v4(),
      platform,
      isPushNotificationsEnabled,
      data: {
        user: {
          id: faker.datatype.uuid(),
          firstName: faker.name.firstName(),
          avatar: faker.image.avatar(),
        },
        member: {
          phone: generatePhone(),
        },
        type: NotificationType.text,
        isVideo: false,
      },
      metadata: { content: faker.lorem.sentence() },
    };
  };
});
