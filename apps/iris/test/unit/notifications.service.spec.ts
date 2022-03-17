import {
  AppointmentInternalKey,
  Platform,
  TodoInternalKey,
  mockLogger,
  mockProcessWarnings,
  translation,
} from '@lagunahealth/pandora';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { hosts } from 'config';
import { internet } from 'faker';
import { replaceConfigs } from '../';
import { LoggerService } from '../../src/common';
import { DbModule } from '../../src/db';
import {
  Internationalization,
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
  let iService: Internationalization;

  beforeAll(async () => {
    mockProcessWarnings(); // to hide pino prettyPrint warning
    module = await Test.createTestingModule({
      imports: [DbModule, ProvidersModule, EventEmitterModule.forRoot()],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
    twilioService = module.get<Twilio>(Twilio);
    iService = module.get<Internationalization>(Internationalization);
    mockLogger(module.get<LoggerService>(LoggerService));

    senderClient = generateUpdateMemberSettingsMock();
    recipientClient = generateUpdateMemberSettingsMock();
  }, 7000);

  afterAll(async () => {
    await module.close();
  });

  test.each([
    AppointmentInternalKey.appointmentReminder,
    AppointmentInternalKey.appointmentLongReminder,
  ])(
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

  test.each(Object.values(TodoInternalKey))(
    `should not send a %p notification since isTodoNotificationsEnabled is false`,
    async (contentKey) => {
      const dispatch = generateDispatch({ contentKey });
      const recipientClient = generateUpdateMemberSettingsMock({
        isTodoNotificationsEnabled: false,
      });

      const spyOnInternationalization = jest.spyOn(iService, 'getContents');

      await service.send(dispatch, recipientClient, senderClient);
      expect(spyOnInternationalization).not.toBeCalled();
    },
  );

  describe(`${AppointmentInternalKey.appointmentRequest}`, () => {
    let scheduleLink: string;
    let dispatch;
    let spyOnTwilioServiceSend: SpyInstance;

    beforeAll(async () => {
      scheduleLink = internet.url();
      dispatch = generateDispatch({
        contentKey: AppointmentInternalKey.appointmentRequest,
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
        content: translation.contents[AppointmentInternalKey.appointmentRequest],
        memberClient: recipientClient,
        userClient: senderClient,
      });

      expect(spyOnTwilioServiceSend).toBeCalledWith(
        {
          body: body + `:\n${scheduleLink}`,
          orgName: recipientClient.orgName,
          to: recipientClient.phone,
        },
        dispatch.correlationId,
      );
    });

    // eslint-disable-next-line max-len
    it(`should create content with request link for members using mobile platform without push notification`, async () => {
      recipientClient.platform = Platform.ios;
      recipientClient.isPushNotificationsEnabled = false;

      recipientClient.platform = await service.send(dispatch, recipientClient, senderClient);

      const body = replaceConfigs({
        content: translation.contents[AppointmentInternalKey.appointmentRequest],
        memberClient: recipientClient,
        userClient: senderClient,
      });

      expect(spyOnTwilioServiceSend).toBeCalledWith(
        {
          body: body + `\n${hosts.get('dynamicLink')}`,
          orgName: recipientClient.orgName,
          to: recipientClient.phone,
        },
        dispatch.correlationId,
      );
    });
  });
});
