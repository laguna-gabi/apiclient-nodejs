import { Test, TestingModule } from '@nestjs/testing';
import { v4 } from 'uuid';
import { NotificationsService, TwilioService } from '../../src/providers';
import { dbDisconnect, defaultModules } from '../common';
import {
  generateCancelNotificationParams,
  generateSendOneSignalNotificationParams,
  generateSendTwilioNotificationParams,
} from '../generators';

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

  it('should send oneSignal notification', async () => {
    const twilioSendMock = jest.spyOn(twilio, 'send');
    const params = { sendTwilioNotification: generateSendTwilioNotificationParams() };
    await notificationsService.send(params);
    expect(twilioSendMock).toBeCalledWith(params.sendTwilioNotification);
    twilioSendMock.mockReset();
  });

  it('should send twilio notification', async () => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const oneSignalSendMock = jest.spyOn(notificationsService.oneSignal, 'send');
    oneSignalSendMock.mockResolvedValue(v4());
    const params = { sendOneSignalNotification: generateSendOneSignalNotificationParams() };
    await notificationsService.send(params);
    expect(oneSignalSendMock).toBeCalledWith(params.sendOneSignalNotification);
    oneSignalSendMock.mockReset();
  });

  it('should send twilio cancel notification', async () => {
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
