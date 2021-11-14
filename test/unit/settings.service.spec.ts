import { Test, TestingModule } from '@nestjs/testing';
import { generateClientSettings, generateId } from '../';
import { DbModule } from '../../src/db/db.module';
import { ClientSettings, SettingsModule, SettingsService } from '../../src/settings';

describe(SettingsService.name, () => {
  let module: TestingModule;
  let service: SettingsService;

  beforeAll(async () => {
    module = await Test.createTestingModule({ imports: [DbModule, SettingsModule] }).compile();

    service = module.get<SettingsService>(SettingsService);
  });

  afterAll(async () => {
    await module.close();
  });

  it('should update for a new member', async () => {
    const settings: ClientSettings = generateClientSettings();
    const result = await service.update(settings);
    expect(result).toEqual(expect.objectContaining(settings));
  });

  it('should update for an existing member', async () => {
    const settings: ClientSettings = generateClientSettings();
    const result = await service.update(settings);
    expect(result).toEqual(expect.objectContaining(settings));

    const newSettings: ClientSettings = generateClientSettings({ id: settings.id });
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
    { firstName: null },
    { avatar: null },
  ])('should not override %p since it is not define in input', async (field) => {
    const settings: ClientSettings = generateClientSettings();
    const result = await service.update(settings);
    expect(result).toEqual(expect.objectContaining(settings));

    let newSettings = generateClientSettings({ id: settings.id });
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

  it('should return a client settings object', async () => {
    const settings: ClientSettings = generateClientSettings();
    await service.update(settings);

    const clientSettings = await service.get(settings.id);
    expect(clientSettings).toEqual(expect.objectContaining(settings));
  });
});
