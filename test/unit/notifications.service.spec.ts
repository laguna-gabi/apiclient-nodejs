import { ContentKey, Platform } from '@lagunahealth/pandora';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { internet } from 'faker';
import { DbModule } from '../../src/db';
import {
  InternationalizationService,
  NotificationsService,
  ProvidersModule,
  Twilio,
} from '../../src/providers';
import { generateDispatch, generateUpdateMemberSettingsMock } from '../generators';
import SpyInstance = jest.SpyInstance;
import { hosts } from 'config';

describe(NotificationsService.name, () => {
  let module: TestingModule;
  let service: NotificationsService;
  let twilioService: Twilio;
  let senderClient;
  let iService: InternationalizationService;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [DbModule, ProvidersModule, EventEmitterModule.forRoot()],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
    twilioService = module.get<Twilio>(Twilio);
    iService = module.get<InternationalizationService>(InternationalizationService);

    senderClient = generateUpdateMemberSettingsMock();
  }, 7000);

  afterAll(async () => {
    await module.close();
  });

  test.each([ContentKey.appointmentReminder, ContentKey.appointmentLongReminder])(
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

  describe('send', () => {
    let scheduleLink: string;
    let dispatch;
    let spyOnTwilioServiceSend: SpyInstance;

    beforeAll(async () => {
      scheduleLink = internet.url();
      dispatch = generateDispatch({
        contentKey: ContentKey.appointmentRequest,
        scheduleLink,
      });

      await iService.onModuleInit();
      spyOnTwilioServiceSend = jest.spyOn(twilioService, 'send');
    });

    afterEach(() => {
      spyOnTwilioServiceSend.mockReset();
    });

    // eslint-disable-next-line max-len
    it(`for content key ${ContentKey.appointmentRequest} to create content with request link for members using web platform`, async () => {
      const recipientClient = generateUpdateMemberSettingsMock({
        platform: Platform.web,
      });

      await service.send(dispatch, recipientClient, senderClient);

      expect(spyOnTwilioServiceSend).toBeCalledWith({
        body:
          // eslint-disable-next-line max-len
          `Hello ${getHonorific(recipientClient)}. ${recipientClient.lastName}, it's ${
            senderClient.firstName
          },` +
          ` your Laguna Health coach. Tap here to schedule our next meeting:\n${scheduleLink}.`,
        orgName: recipientClient.orgName,
        to: recipientClient.phone,
      });
    });

    // eslint-disable-next-line max-len
    it(`for content key ${ContentKey.appointmentRequest} to create content with request link for members using mobile platform without push notification`, async () => {
      const recipientClient = generateUpdateMemberSettingsMock({
        platform: Platform.ios,
      });

      await service.send(dispatch, recipientClient, senderClient);

      expect(spyOnTwilioServiceSend).toBeCalledWith({
        body:
          // eslint-disable-next-line max-len
          `Hello ${getHonorific(recipientClient)}. ${recipientClient.lastName}, it's ${
            senderClient.firstName
          },` +
          ` your Laguna Health coach. Tap here to schedule our next meeting\n${hosts.get(
            'dynamicLink',
          )}`,
        orgName: recipientClient.orgName,
        to: recipientClient.phone,
      });
    });
  });

  /*************************************************************************************************
   ******************************************** Helpers ********************************************
   ************************************************************************************************/

  const getHonorific = (recipientClient): string => {
    return recipientClient.honorific.charAt(0).toUpperCase() + recipientClient.honorific.slice(1);
  };
});
