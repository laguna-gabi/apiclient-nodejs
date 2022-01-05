import { mockLogger } from '@lagunahealth/pandora';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { LoggerService } from '../../src/common';
import { generateId, generateUpdateMemberSettingsMock } from '../';
import { DbModule } from '../../src/db';
import { ClientSettings, SettingsModule, SettingsService } from '../../src/settings';

describe(SettingsService.name, () => {
  let module: TestingModule;
  let service: SettingsService;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [DbModule, SettingsModule, EventEmitterModule.forRoot()],
    }).compile();

    service = module.get<SettingsService>(SettingsService);
    mockLogger(module.get<LoggerService>(LoggerService));
  });

  afterAll(async () => {
    await module.close();
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

  it('should update, get and delete a client settings object', async () => {
    const settings: ClientSettings = generateUpdateMemberSettingsMock();
    await service.update(settings);

    let clientSettings = await service.get(settings.id);
    expect(clientSettings).toEqual(expect.objectContaining(settings));

    await service.delete(settings.id);

    clientSettings = await service.get(settings.id);
    expect(clientSettings).toBeNull();
  });

  it('should be able to delete without error, if id does not exist', async () => {
    const result = await service.delete(generateId());
    expect(result).toBeUndefined();
  });
});
