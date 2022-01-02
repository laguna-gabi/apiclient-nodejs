import { InnerQueueTypes, mockLogger } from '@lagunahealth/pandora';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { gapTriggersAt } from 'config';
import { addDays, addHours, addSeconds, subSeconds } from 'date-fns';
import { animal, lorem } from 'faker';
import { CommonModule, Logger } from '../../src/common';
import {
  ConductorModule,
  ConductorService,
  DispatchStatus,
  DispatchesService,
  TriggersService,
} from '../../src/conductor';
import { DbModule } from '../../src/db';
import {
  NotificationsService,
  Provider,
  ProviderResult,
  ProvidersModule,
} from '../../src/providers';
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
      imports: [
        DbModule,
        ProvidersModule,
        ConductorModule,
        CommonModule,
        EventEmitterModule.forRoot(),
      ],
    }).compile();

    service = module.get<ConductorService>(ConductorService);
    settingsService = module.get<SettingsService>(SettingsService);
    dispatchesService = module.get<DispatchesService>(DispatchesService);
    triggersService = module.get<TriggersService>(TriggersService);
    notificationsService = module.get<NotificationsService>(NotificationsService);
    logger = module.get<Logger>(Logger);
    mockLogger(logger);

    await service.onModuleInit();
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
    let spyOnWarn: SpyInstance;
    let spyOnNotificationsService: SpyInstance;

    beforeAll(() => {
      spyOnDispatchesServiceUpdate = jest.spyOn(dispatchesService, 'update');
      spyOnDispatchesServiceInternalUpdate = jest.spyOn(dispatchesService, 'internalUpdate');
      spyOnTriggersServiceUpdate = jest.spyOn(triggersService, 'update');
      spyOnError = jest.spyOn(logger, 'error');
      spyOnWarn = jest.spyOn(logger, 'warn');
      spyOnNotificationsService = jest.spyOn(notificationsService, 'send');
    });

    afterEach(() => {
      spyOnDispatchesServiceUpdate.mockReset();
      spyOnDispatchesServiceInternalUpdate.mockReset();
      spyOnTriggersServiceUpdate.mockReset();
      spyOnError.mockReset();
      spyOnWarn.mockReset();
      spyOnNotificationsService.mockReset();
    });

    it(`should handle triggersAt from more ${gapTriggersAt} seconds in the past`, async () => {
      const createDispatch = generateDispatch({
        triggersAt: subSeconds(new Date(), gapTriggersAt + 1),
      });
      spyOnDispatchesServiceUpdate.mockResolvedValueOnce(createDispatch);

      await service.handleCreateDispatch({
        ...createDispatch,
        type: InnerQueueTypes.createDispatch,
      });

      expect(new Date().getTime()).toBeGreaterThan(createDispatch.triggersAt.getTime());
      expect(spyOnDispatchesServiceUpdate).toBeCalledWith(createDispatch);
      expect(spyOnTriggersServiceUpdate).not.toBeCalled();
      expect(spyOnNotificationsService).not.toBeCalled();
      expect(spyOnWarn).toBeCalledWith(
        createDispatch,
        ConductorService.name,
        'handleCreateDispatch',
      );
    });

    it(`should handle triggersAt of undefined as real time`, async () => {
      await handleRealEvents(false);
    }, 10000);

    it(`should handle triggersAt within the past/future ${gapTriggersAt} seconds`, async () => {
      await handleRealEvents(true);
    }, 10000);

    const handleRealEvents = async (triggersAt: boolean) => {
      const memberSettings = generateUpdateMemberSettingsMock();
      const userSettings = generateUpdateUserSettingsMock();
      const type: InnerQueueTypes = InnerQueueTypes.updateClientSettings;
      await service.handleUpdateClientSettings({ ...memberSettings, type });
      await service.handleUpdateClientSettings({ ...userSettings, type });

      const dispatch = generateDispatch({
        recipientClientId: memberSettings.id,
        senderClientId: userSettings.id,
      });
      dispatch.triggersAt = triggersAt ? subSeconds(new Date(), gapTriggersAt) : undefined;

      spyOnDispatchesServiceInternalUpdate.mockResolvedValueOnce(dispatch);
      spyOnDispatchesServiceUpdate.mockResolvedValueOnce(dispatch);
      const providerResult: ProviderResult = {
        provider: Provider.twilio,
        content: lorem.sentence(),
        id: generateId(),
      };
      spyOnNotificationsService.mockResolvedValueOnce(providerResult);
      await service.handleCreateDispatch({ ...dispatch, type: InnerQueueTypes.createDispatch });

      if (triggersAt) {
        expect(new Date().getTime()).toBeGreaterThan(dispatch.triggersAt.getTime());
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
      dispatch.triggersAt = undefined;
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

    it(`should handle triggersAt more than ${gapTriggersAt} seconds in the future`, async () => {
      const createDispatch = generateDispatch({
        triggersAt: addSeconds(new Date(), gapTriggersAt + 2),
      });
      spyOnDispatchesServiceUpdate.mockResolvedValueOnce(createDispatch);
      spyOnTriggersServiceUpdate.mockResolvedValueOnce({ _id: generateId() });

      await service.handleCreateDispatch({
        ...createDispatch,
        type: InnerQueueTypes.createDispatch,
      });

      expect(new Date().getTime()).toBeLessThan(createDispatch.triggersAt.getTime());
      expect(spyOnDispatchesServiceUpdate).toBeCalledWith(createDispatch);
      expect(spyOnTriggersServiceUpdate).toBeCalledWith({
        dispatchId: createDispatch.dispatchId,
        expireAt: createDispatch.triggersAt,
      });
      expect(spyOnNotificationsService).not.toBeCalled();
      expect(spyOnError).not.toBeCalled();
    });

    it('should update a dispatch with the same id on dispatches and triggers', async () => {
      const dispatch1 = generateDispatch({ triggersAt: addDays(new Date(), 1) });
      const dispatch2 = generateDispatch({
        dispatchId: dispatch1.dispatchId,
        triggersAt: addHours(new Date(), 2),
      });
      const triggeredId = generateId();

      spyOnDispatchesServiceUpdate.mockResolvedValueOnce(dispatch1);
      spyOnDispatchesServiceUpdate.mockResolvedValueOnce(dispatch2);
      spyOnDispatchesServiceInternalUpdate.mockResolvedValueOnce(dispatch1);
      spyOnDispatchesServiceInternalUpdate.mockResolvedValueOnce(dispatch2);
      spyOnTriggersServiceUpdate.mockResolvedValue({ _id: triggeredId });

      const type = InnerQueueTypes.createDispatch;
      await service.handleCreateDispatch({ ...dispatch1, type });
      await service.handleCreateDispatch({ ...dispatch2, type });

      expect(spyOnDispatchesServiceUpdate).toHaveBeenNthCalledWith(1, dispatch1);
      expect(spyOnDispatchesServiceUpdate).toHaveBeenNthCalledWith(2, dispatch2);
      expect(spyOnDispatchesServiceInternalUpdate).toHaveBeenNthCalledWith(1, {
        dispatchId: dispatch1.dispatchId,
        triggeredId,
      });
      expect(spyOnDispatchesServiceInternalUpdate).toHaveBeenNthCalledWith(2, {
        dispatchId: dispatch1.dispatchId,
        triggeredId,
      });
      expect(spyOnTriggersServiceUpdate).toBeCalledWith({
        dispatchId: dispatch1.dispatchId,
        expireAt: dispatch2.triggersAt,
      });
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
