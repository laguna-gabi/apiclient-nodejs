import { generateId, mockLogger, mockProcessWarnings } from '@argus/pandora';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { Model, model } from 'mongoose';
import { dbConnect, dbDisconnect, generateUpdateMemberSettingsMock } from '../';
import { LoggerService } from '../../src/common';
import { DbModule } from '../../src/db';
import {
  ClientSettings,
  ClientSettingsDocument,
  ClientSettingsDto,
  SettingsModule,
  SettingsService,
} from '../../src/settings';

describe(SettingsService.name, () => {
  let module: TestingModule;
  let service: SettingsService;
  let clientSettingsModel: Model<ClientSettingsDocument>;

  beforeAll(async () => {
    mockProcessWarnings(); // to hide pino prettyPrint warning
    module = await Test.createTestingModule({
      imports: [DbModule, SettingsModule, EventEmitterModule.forRoot()],
    }).compile();

    service = module.get<SettingsService>(SettingsService);
    mockLogger(module.get<LoggerService>(LoggerService));
    clientSettingsModel = model<ClientSettingsDocument>(ClientSettings.name, ClientSettingsDto);

    await dbConnect();
  });

  afterAll(async () => {
    await module.close();
    await dbDisconnect();
  });

  it('should update for a new client', async () => {
    const settings: ClientSettings = generateUpdateMemberSettingsMock();
    const result = await service.update(settings);
    expect(result).toEqual(expect.objectContaining(settings));
  });

  it('should update for an existing client', async () => {
    const settings: ClientSettings = generateUpdateMemberSettingsMock();
    const result = await service.update(settings);
    expect(result).toEqual(expect.objectContaining(settings));

    const newSettings: ClientSettings = generateUpdateMemberSettingsMock({ id: settings.id });
    const resultNew = await service.update(newSettings);
    expect(resultNew).toEqual(expect.objectContaining(newSettings));
  });

  test.each([
    { orgName: null },
    { phone: null },
    { platform: null },
    { externalUserId: null },
    { isPushNotificationsEnabled: null },
    { isAppointmentsReminderEnabled: null },
    { isTodoNotificationsEnabled: null },
  ])('should not override %p since it is not define in input', async (field) => {
    const settings: ClientSettings = generateUpdateMemberSettingsMock();
    const result = await service.update(settings);
    expect(result).toEqual(expect.objectContaining(settings));

    let newSettings = generateUpdateMemberSettingsMock({ id: settings.id });
    newSettings = { ...newSettings, ...field };

    const resultNew = await service.update(newSettings);
    const expected = { ...newSettings };
    const key = Object.keys(field)[0];
    expected[key] = result[key];

    expect(resultNew).toEqual(expect.objectContaining(expected));
  });

  it('should return undefined for a non existing client settings', async () => {
    const clientSettings = await service.get(generateId());
    expect(clientSettings).toBeNull();
  });

  test.each([true, false])(
    'should update, get and delete a client settings object',
    async (hard) => {
      const settings: ClientSettings = generateUpdateMemberSettingsMock();
      await service.update(settings);

      const clientSettings = await service.get(settings.id);
      expect(clientSettings).toEqual(expect.objectContaining(settings));

      await service.delete(settings.id, hard);

      if (hard) {
        /* eslint-disable @typescript-eslint/ban-ts-comment */
        // @ts-ignore
        const clientSettings = await clientSettingsModel.findWithDeleted({ id: settings.id });
        expect(clientSettings.length).toEqual(0);
      } else {
        /* eslint-disable @typescript-eslint/ban-ts-comment */
        // @ts-ignore
        const clientSettings = await clientSettingsModel.findWithDeleted({ id: settings.id });
        expect(clientSettings).toEqual(
          expect.arrayContaining([expect.objectContaining({ ...settings, deleted: true })]),
        );
      }
    },
  );

  test.each([true, false])(
    'should be able to delete without error, if id does not exist',
    async (hard) => {
      const result = await service.delete(generateId(), hard);
      expect(result).toBeUndefined();
    },
  );
});
