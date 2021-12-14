import { ContentKey } from '@lagunahealth/pandora';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { DbModule } from '../../src/db';
import {
  InternationalizationService,
  NotificationsService,
  ProvidersModule,
} from '../../src/providers';
import { generateDispatch, generateUpdateMemberSettingsMock } from '../generators';

describe(NotificationsService.name, () => {
  let module: TestingModule;
  let service: NotificationsService;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [DbModule, ProvidersModule, EventEmitterModule.forRoot()],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
  });

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
      const senderClient = generateUpdateMemberSettingsMock();

      const iService = module.get<InternationalizationService>(InternationalizationService);
      const spyOnInternationalization = jest.spyOn(iService, 'getContents');

      await service.send(dispatch, recipientClient, senderClient);
      expect(spyOnInternationalization).not.toBeCalled();
    },
  );
});
