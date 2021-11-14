import { Test, TestingModule } from '@nestjs/testing';
import { DbModule } from '../../src/db/db.module';
import { Dispatch, DispatchesModule, DispatchesService } from '../../src/dispatches';
import { generateDispatch } from '../generators';
import { v4 } from 'uuid';

describe(DispatchesService.name, () => {
  let module: TestingModule;
  let service: DispatchesService;

  beforeAll(async () => {
    module = await Test.createTestingModule({ imports: [DbModule, DispatchesModule] }).compile();

    service = module.get<DispatchesService>(DispatchesService);
  });

  afterAll(async () => {
    await module.close();
  });

  it('should return undefined for a non existing dispatch', async () => {
    const dispatch = await service.get(v4());
    expect(dispatch).toBeNull();
  });

  it('should update and get a new dispatch', async () => {
    const dispatch: Dispatch = generateDispatch();
    const result = await service.update(dispatch);
    expect(result).toEqual(expect.objectContaining(dispatch));

    const resultGet = await service.get(dispatch.dispatchId);
    expect(resultGet).toEqual(expect.objectContaining(dispatch));
  });

  it('should update for an existing dispatch', async () => {
    const dispatch: Dispatch = generateDispatch();
    const result = await service.update(dispatch);
    expect(result).toEqual(expect.objectContaining(dispatch));

    const newDispatch: Dispatch = generateDispatch({ dispatchId: dispatch.dispatchId });
    const resultNew = await service.update(newDispatch);
    expect(resultNew).toEqual(expect.objectContaining(newDispatch));
  });

  // test.each([
  //   { orgName: null },
  //   { phone: null },
  //   { platform: null },
  //   { externalUserId: null },
  //   { isPushNotificationsEnabled: null },
  //   { isAppointmentsReminderEnabled: null },
  //   { firstName: null },
  //   { avatar: null },
  // ])('should not override %p since it is not define in input', async (field) => {
  //   const settings: ClientSettings = generateClientSettings();
  //   const result = await service.update(settings);
  //   expect(result).toEqual(expect.objectContaining(settings));
  //
  //   let newSettings = generateClientSettings({ id: settings.id });
  //   newSettings = { ...newSettings, ...field };
  //
  //   const resultNew = await service.update(newSettings);
  //   const expected = { ...newSettings };
  //   const key = Object.keys(field)[0];
  //   expected[key] = result[key];
  //
  //   expect(resultNew).toEqual(expect.objectContaining(expected));
  // });
});
