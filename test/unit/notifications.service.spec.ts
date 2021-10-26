import { Test, TestingModule } from '@nestjs/testing';
import { v4 } from 'uuid';
import { InternalNotificationType } from '../../src/common';
import { NotificationsService, SendBird, TwilioService } from '../../src/providers';
import { dbDisconnect, defaultModules } from '../common';
import {
  generateCancelNotificationParams,
  generateSendOneSignalNotificationParams,
  generateSendSendBirdNotificationParams,
  generateSendTwilioNotificationParams,
  mockGenerateMemberConfig,
} from '../generators';

describe('NotificationsService (offline)', () => {
  let module: TestingModule;
  let notificationsService: NotificationsService;
  let twilio: TwilioService;
  let sendBird: SendBird;
  beforeAll(async () => {
    module = await Test.createTestingModule({ imports: defaultModules() }).compile();

    notificationsService = module.get<NotificationsService>(NotificationsService);
    twilio = module.get<TwilioService>(TwilioService);
    sendBird = module.get<SendBird>(SendBird);
  });

  afterAll(async () => {
    await module.close();
    await dbDisconnect();
  });

  it('should register member for notification', async () => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const oneSignalSendMock = jest.spyOn(notificationsService.oneSignal, 'register');
    oneSignalSendMock.mockResolvedValue(undefined);
    const params = { token: v4(), externalUserId: v4() };
    await notificationsService.register(params);
    expect(oneSignalSendMock).toBeCalledWith(params);
    oneSignalSendMock.mockReset();
  });

  it('should unregister member from notification', async () => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const oneSignalSendMock = jest.spyOn(notificationsService.oneSignal, 'unregister');
    oneSignalSendMock.mockResolvedValue(undefined);
    const memberConfig = mockGenerateMemberConfig();
    await notificationsService.unregister(memberConfig);
    expect(oneSignalSendMock).toBeCalledWith(memberConfig);
    oneSignalSendMock.mockReset();
  });

  it('should send twilio notification', async () => {
    const twilioSendMock = jest.spyOn(twilio, 'send');
    const params = { sendTwilioNotification: generateSendTwilioNotificationParams() };
    await notificationsService.send(params);
    expect(twilioSendMock).toBeCalledWith(params.sendTwilioNotification);
    twilioSendMock.mockReset();
  });

  it('should send oneSignal notification', async () => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const oneSignalSendMock = jest.spyOn(notificationsService.oneSignal, 'send');
    oneSignalSendMock.mockResolvedValue(v4());
    const params = { sendOneSignalNotification: generateSendOneSignalNotificationParams() };
    await notificationsService.send(params);
    expect(oneSignalSendMock).toBeCalledWith(params.sendOneSignalNotification);
    oneSignalSendMock.mockReset();
  });

  it('should send sendBird notification', async () => {
    const sendBirdSendMock = jest.spyOn(sendBird, 'send');
    const params = {
      sendSendBirdNotification: generateSendSendBirdNotificationParams(
        InternalNotificationType.chatMessageToUser,
      ),
    };
    await notificationsService.send(params);
    expect(sendBirdSendMock).toBeCalledWith(params.sendSendBirdNotification);
    sendBirdSendMock.mockReset();
  });

  it('should send oneSignal cancel notification', async () => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const oneSignalCancelMock = jest.spyOn(notificationsService.oneSignal, 'cancel');
    oneSignalCancelMock.mockResolvedValue(v4());
    const params = generateCancelNotificationParams();
    await notificationsService.cancel(params);
    expect(oneSignalCancelMock).toBeCalledWith(params);
    oneSignalCancelMock.mockReset();
  });
});
