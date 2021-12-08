import { InnerQueueTypes } from '@lagunahealth/pandora';
import { Test, TestingModule } from '@nestjs/testing';
import { gapTriggeredAt } from 'config';
import { addSeconds, subSeconds } from 'date-fns';
import { animal } from 'faker';
import { CommonModule, Logger } from '../../src/common';
import {
  ConductorModule,
  ConductorService,
  DispatchStatus,
  DispatchesService,
  TriggersService,
} from '../../src/conductor';
import { DbModule } from '../../src/db';
import { NotificationsService, ProvidersModule } from '../../src/providers';
import { SettingsService } from '../../src/settings';
import {
  delay,
  generateDispatch,
  generateId,
  generateUpdateMemberSettingsMock,
  generateUpdateUserSettingsMock,
} from '../generators';
import SpyInstance = jest.SpyInstance;

describe(ConductorService.name, () => {
  let module: TestingModule;
  let service: ConductorService;
  let settingsService: SettingsService;
  let dispatchesService: DispatchesService;
  let triggersService: TriggersService;
  let notificationsService: NotificationsService;
  let logger: Logger;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [DbModule, ProvidersModule, ConductorModule, CommonModule],
    }).compile();

    service = module.get<ConductorService>(ConductorService);
    settingsService = module.get<SettingsService>(SettingsService);
    dispatchesService = module.get<DispatchesService>(DispatchesService);
    triggersService = module.get<TriggersService>(TriggersService);
    notificationsService = module.get<NotificationsService>(NotificationsService);
    logger = module.get<Logger>(Logger);
  });

  afterAll(async () => {
    await module.close();
  });

  describe('handleUpdateClientSettings', () => {
    let spyOnSettingsServiceUpdate: SpyInstance;

    beforeAll(() => {
      spyOnSettingsServiceUpdate = jest.spyOn(settingsService, 'update');
    });
    afterEach(async () => {
      spyOnSettingsServiceUpdate.mockRestore();
    });

    it('should call handleUpdateClientSettings', async () => {
      const settings = generateUpdateMemberSettingsMock();
      spyOnSettingsServiceUpdate.mockResolvedValueOnce(settings);

      await service.handleUpdateClientSettings({
        ...settings,
        type: InnerQueueTypes.updateClientSettings,
      });
      expect(spyOnSettingsServiceUpdate).toBeCalledWith(settings);
    });
  });

  describe('handleCreateDispatch', () => {
    let spyOnDispatchesServiceUpdate: SpyInstance;
    let spyOnDispatchesServiceInternalUpdate: SpyInstance;
    let spyOnTriggersServiceUpdate: SpyInstance;
    let spyOnError: SpyInstance;
    let spyOnNotificationsService: SpyInstance;

    beforeAll(() => {
      spyOnDispatchesServiceUpdate = jest.spyOn(dispatchesService, 'update');
      spyOnDispatchesServiceInternalUpdate = jest.spyOn(dispatchesService, 'internalUpdate');
      spyOnTriggersServiceUpdate = jest.spyOn(triggersService, 'update');
      spyOnError = jest.spyOn(logger, 'error');
      spyOnNotificationsService = jest.spyOn(notificationsService, 'send');
    });

    afterEach(() => {
      spyOnDispatchesServiceUpdate.mockReset();
      spyOnDispatchesServiceInternalUpdate.mockReset();
      spyOnTriggersServiceUpdate.mockReset();
      spyOnError.mockReset();
      spyOnNotificationsService.mockReset();
    });

    it(`should handle triggeredAt from more ${gapTriggeredAt} seconds in the past`, async () => {
      const createDispatch = generateDispatch({
        triggeredAt: subSeconds(new Date(), gapTriggeredAt + 1),
      });
      spyOnDispatchesServiceUpdate.mockResolvedValueOnce(createDispatch);

      await service.handleCreateDispatch({
        ...createDispatch,
        type: InnerQueueTypes.createDispatch,
      });

      expect(new Date().getTime()).toBeGreaterThan(createDispatch.triggeredAt.getTime());
      expect(spyOnDispatchesServiceUpdate).toBeCalledWith(createDispatch);
      expect(spyOnTriggersServiceUpdate).not.toBeCalled();
      expect(spyOnNotificationsService).not.toBeCalled();
      expect(spyOnError).toBeCalledWith(
        createDispatch,
        ConductorService.name,
        'handleCreateDispatch',
      );
    });

    it(`should handle triggeredAt of undefined as real time`, async () => {
      await handleRealEvents(false);
    }, 10000);

    it(`should handle triggeredAt within the past/future ${gapTriggeredAt} seconds`, async () => {
      await handleRealEvents(true);
    }, 10000);

    const handleRealEvents = async (triggeredAt: boolean) => {
      const memberSettings = generateUpdateMemberSettingsMock();
      const userSettings = generateUpdateUserSettingsMock();
      const type: InnerQueueTypes = InnerQueueTypes.updateClientSettings;
      await service.handleUpdateClientSettings({ ...memberSettings, type });
      await service.handleUpdateClientSettings({ ...userSettings, type });

      const dispatch = generateDispatch({
        recipientClientId: memberSettings.id,
        senderClientId: userSettings.id,
      });
      dispatch.triggeredAt = triggeredAt ? subSeconds(new Date(), gapTriggeredAt) : undefined;

      spyOnDispatchesServiceInternalUpdate.mockResolvedValue(dispatch);
      spyOnDispatchesServiceUpdate.mockResolvedValue(dispatch);
      spyOnNotificationsService.mockResolvedValueOnce(null);
      await service.handleCreateDispatch({ ...dispatch, type: InnerQueueTypes.createDispatch });

      if (triggeredAt) {
        expect(new Date().getTime()).toBeGreaterThan(dispatch.triggeredAt.getTime());
      }
      expect(spyOnDispatchesServiceUpdate).toBeCalledWith(dispatch);
      expect(spyOnTriggersServiceUpdate).not.toBeCalled();
      expect(spyOnNotificationsService).toBeCalledWith(
        dispatch,
        expect.objectContaining(memberSettings),
        expect.objectContaining(userSettings),
      );
      expect(spyOnError).not.toBeCalled();
    };

    it('should retry a dispatch', async () => {
      const memberSettings = generateUpdateMemberSettingsMock();
      const userSettings = generateUpdateUserSettingsMock();
      const type: InnerQueueTypes = InnerQueueTypes.updateClientSettings;
      await service.handleUpdateClientSettings({ ...memberSettings, type });
      await service.handleUpdateClientSettings({ ...userSettings, type });

      const dispatch = generateDispatch({
        recipientClientId: memberSettings.id,
        senderClientId: userSettings.id,
      });
      dispatch.triggeredAt = undefined;
      spyOnDispatchesServiceUpdate.mockResolvedValueOnce(dispatch);

      const failureReasons = [
        { message: animal.dog(), stack: animal.crocodilia() },
        { message: animal.cow(), stack: animal.horse() },
      ];
      const generateObject = (status, retryCount: number, failureReasons: any[] = []) => {
        return { ...dispatch, failureReasons, status, retryCount };
      };
      const resolvedValues = [
        generateObject(DispatchStatus.acquired, 0),
        generateObject(DispatchStatus.error, 1, [failureReasons[0]]),
        generateObject(DispatchStatus.acquired, 1, [failureReasons[0]]),
        generateObject(DispatchStatus.error, 2, failureReasons),
        generateObject(DispatchStatus.acquired, 2, failureReasons),
        generateObject(DispatchStatus.done, 2),
      ];
      resolvedValues.map((value) => {
        spyOnDispatchesServiceInternalUpdate.mockResolvedValueOnce(value);
      });

      spyOnNotificationsService.mockRejectedValueOnce(failureReasons[0]);
      spyOnNotificationsService.mockRejectedValueOnce(failureReasons[1]);
      spyOnNotificationsService.mockResolvedValueOnce(undefined);

      await service.handleCreateDispatch({ ...dispatch, type: InnerQueueTypes.createDispatch });

      await delay(7000);

      expect(spyOnDispatchesServiceInternalUpdate).toBeCalledTimes(resolvedValues.length);
      for (let i = 1; i <= resolvedValues.length; i++) {
        expect(spyOnDispatchesServiceInternalUpdate).toHaveBeenNthCalledWith(
          i,
          expect.objectContaining({ status: resolvedValues[i - 1].status }),
        );
      }
      expect(spyOnNotificationsService).toBeCalledWith(
        resolvedValues[resolvedValues.length - 2],
        expect.objectContaining(memberSettings),
        expect.objectContaining(userSettings),
      );
      expect(spyOnError).not.toBeCalled();
    }, 12000);

    it(`should handle triggeredAt more than ${gapTriggeredAt} seconds in the future`, async () => {
      const createDispatch = generateDispatch({
        triggeredAt: addSeconds(new Date(), gapTriggeredAt + 2),
      });
      spyOnDispatchesServiceUpdate.mockResolvedValueOnce(createDispatch);

      await service.handleCreateDispatch({
        ...createDispatch,
        type: InnerQueueTypes.createDispatch,
      });

      expect(new Date().getTime()).toBeLessThan(createDispatch.triggeredAt.getTime());
      expect(spyOnDispatchesServiceUpdate).toBeCalledWith(createDispatch);
      expect(spyOnTriggersServiceUpdate).toBeCalledWith({
        dispatchId: createDispatch.dispatchId,
        expiresAt: createDispatch.triggeredAt,
      });
      expect(spyOnNotificationsService).not.toBeCalled();
      expect(spyOnError).not.toBeCalled();
    });
  });

  describe('handleDeleteDispatch', () => {
    let spyOnDispatchesServiceInternalUpdate: SpyInstance;

    beforeAll(() => {
      spyOnDispatchesServiceInternalUpdate = jest.spyOn(dispatchesService, 'internalUpdate');
    });

    afterEach(() => {
      spyOnDispatchesServiceInternalUpdate.mockReset();
    });

    it('should call handleDeleteDispatch with an existing dispatch', async () => {
      const deleteDispatch = { dispatchId: generateId() };
      spyOnDispatchesServiceInternalUpdate.mockResolvedValueOnce(deleteDispatch);

      await service.handleDeleteDispatch({
        ...deleteDispatch,
        type: InnerQueueTypes.deleteDispatch,
      });
      expect(spyOnDispatchesServiceInternalUpdate).toBeCalledWith({
        dispatchId: deleteDispatch.dispatchId,
        status: DispatchStatus.canceled,
      });
    });

    it('should log warn on handleDeleteDispatch with a non existing dispatch', async () => {
      const deleteDispatch = { dispatchId: generateId() };
      spyOnDispatchesServiceInternalUpdate.mockResolvedValueOnce(null);

      const logger = module.get<Logger>(Logger);
      const spyOnWarn = jest.spyOn(logger, 'warn');
      spyOnWarn.mockImplementationOnce(() => null);

      await service.handleDeleteDispatch({
        ...deleteDispatch,
        type: InnerQueueTypes.deleteDispatch,
      });
      expect(spyOnDispatchesServiceInternalUpdate).toBeCalledWith({
        dispatchId: deleteDispatch.dispatchId,
        status: DispatchStatus.canceled,
      });
      expect(spyOnWarn).toBeCalledWith(
        deleteDispatch,
        ConductorService.name,
        'handleDeleteDispatch',
      );

      spyOnWarn.mockReset();
    });
  });
});
