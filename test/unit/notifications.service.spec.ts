import { InternalKey, Platform, mockLogger } from '@lagunahealth/pandora';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { hosts } from 'config';
import { internet } from 'faker';
import { replaceConfigs } from '../';
import { translation } from '../../languages/en.json';
import { LoggerService } from '../../src/common';
import { DbModule } from '../../src/db';
import {
  InternationalizationService,
  NotificationsService,
  ProvidersModule,
  Twilio,
} from '../../src/providers';
import { generateDispatch, generateUpdateMemberSettingsMock } from '../generators';
import SpyInstance = jest.SpyInstance;

describe(NotificationsService.name, () => {
  let module: TestingModule;
  let service: NotificationsService;
  let twilioService: Twilio;
  let senderClient;
  let recipientClient;
  let iService: InternationalizationService;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [DbModule, ProvidersModule, EventEmitterModule.forRoot()],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
    twilioService = module.get<Twilio>(Twilio);
    iService = module.get<InternationalizationService>(InternationalizationService);
    mockLogger(module.get<LoggerService>(LoggerService));

    senderClient = generateUpdateMemberSettingsMock();
    recipientClient = generateUpdateMemberSettingsMock();
  }, 7000);

  afterAll(async () => {
    await module.close();
  });

  test.each([InternalKey.appointmentReminder, InternalKey.appointmentLongReminder])(
    `should not send a $contentKey notification since isAppointmentsReminderEnabled is false`,
    async (contentKey) => {
      const dispatch = generateDispatch({ contentKey });
      const recipientClient = generateUpdateMemberSettingsMock({
        isAppointmentsReminderEnabled: false,
      });

      const spyOnInternationalization = jest.spyOn(iService, 'getContents');

      await service.send(dispatch, recipientClient, senderClient);
      expect(spyOnInternationalization).not.toBeCalled();
    },
  );

  describe(`${InternalKey.appointmentRequest}`, () => {
    let scheduleLink: string;
    let dispatch;
    let spyOnTwilioServiceSend: SpyInstance;

    beforeAll(async () => {
      scheduleLink = internet.url();
      dispatch = generateDispatch({
        contentKey: InternalKey.appointmentRequest,
        scheduleLink,
      });
      dispatch.content = undefined;

      await iService.onModuleInit();
      spyOnTwilioServiceSend = jest.spyOn(twilioService, 'send');
    });

    beforeEach(() => {
      spyOnTwilioServiceSend.mockReturnValueOnce(undefined);
    });

    afterEach(() => {
      spyOnTwilioServiceSend.mockReset();
    });

    it(`should create content with request link for members using web platform`, async () => {
      recipientClient.platform = Platform.web;

      await service.send(dispatch, recipientClient, senderClient);

      const body = replaceConfigs({
        content: translation.contents[InternalKey.appointmentRequest],
        memberClient: recipientClient,
        userClient: senderClient,
      });

      expect(spyOnTwilioServiceSend).toBeCalledWith({
        body: body + `:\n${scheduleLink}.`,
        orgName: recipientClient.orgName,
        to: recipientClient.phone,
      });
    });

    // eslint-disable-next-line max-len
    it(`should create content with request link for members using mobile platform without push notification`, async () => {
      recipientClient.platform = Platform.ios;
      recipientClient.isPushNotificationsEnabled = false;

      recipientClient.platform = await service.send(dispatch, recipientClient, senderClient);

      const body = replaceConfigs({
        content: translation.contents[InternalKey.appointmentRequest],
        memberClient: recipientClient,
        userClient: senderClient,
      });

      expect(spyOnTwilioServiceSend).toBeCalledWith({
        body: body + `\n${hosts.get('dynamicLink')}`,
        orgName: recipientClient.orgName,
        to: recipientClient.phone,
      });
    });
  });
});
