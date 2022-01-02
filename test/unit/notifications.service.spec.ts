import { InternalNotificationType, mockLogger } from '@lagunahealth/pandora';
import { Test, TestingModule } from '@nestjs/testing';
import { v4 } from 'uuid';
import { LoggerService } from '../../src/common';
import { NotificationsService, SendBird } from '../../src/providers';
import { dbDisconnect, defaultModules } from '../common';
import {
  generateSendOneSignalNotificationParams,
  generateSendSendBirdNotificationParams,
  mockGenerateMemberConfig,
} from '../generators';

describe('NotificationsService (offline)', () => {
  let module: TestingModule;
  let notificationsService: NotificationsService;
  let sendBird: SendBird;
  beforeAll(async () => {
    module = await Test.createTestingModule({ imports: defaultModules() }).compile();

    notificationsService = module.get<NotificationsService>(NotificationsService);
    sendBird = module.get<SendBird>(SendBird);
    mockLogger(module.get<LoggerService>(LoggerService));
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

  it('should send admin sendBird notification', async () => {
    const sendBirdSendMockSendAdminMessage = jest.spyOn(sendBird, 'sendAdminMessage');
    const params = {
      sendSendBirdNotification: generateSendSendBirdNotificationParams(
        InternalNotificationType.chatMessageToUser,
      ),
    };
    await notificationsService.send(params);
    expect(sendBirdSendMockSendAdminMessage).toBeCalledWith(params.sendSendBirdNotification);
    sendBirdSendMockSendAdminMessage.mockReset();
  });

  it('should send journal sendBird notification', async () => {
    const sendBirdSendMockSendJournalMessage = jest.spyOn(sendBird, 'sendJournalMessage');
    const params = {
      sendSendBirdNotification: generateSendSendBirdNotificationParams(
        InternalNotificationType.chatMessageJournal,
      ),
    };
    await notificationsService.send(params);
    expect(sendBirdSendMockSendJournalMessage).toBeCalledWith(params.sendSendBirdNotification);
    sendBirdSendMockSendJournalMessage.mockReset();
  });
});
