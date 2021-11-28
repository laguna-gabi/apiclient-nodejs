import { InnerQueueTypes } from '@lagunahealth/pandora';
import { Test, TestingModule } from '@nestjs/testing';
import { addSeconds, subSeconds } from 'date-fns';
import { CommonModule, Logger } from '../../src/common';
import {
  ConductorModule,
  ConductorService,
  DispatchStatus,
  DispatchesService,
  Hub,
  TriggersService,
} from '../../src/conductor';
import { DbModule } from '../../src/db';
import { ProvidersModule } from '../../src/providers';
import { SettingsService } from '../../src/settings';
import { generateClientSettings, generateDispatch, generateId } from '../generators';
import { gapTriggeredAt } from 'config';
import SpyInstance = jest.SpyInstance;

describe(ConductorService.name, () => {
  let module: TestingModule;
  let service: ConductorService;
  let settingsService: SettingsService;
  let dispatchesService: DispatchesService;
  let triggersService: TriggersService;
  let hub: Hub;
  let logger: Logger;

  let spyOnSettingsServiceUpdate: SpyInstance;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [DbModule, ProvidersModule, ConductorModule, CommonModule],
    }).compile();

    service = module.get<ConductorService>(ConductorService);
    settingsService = module.get<SettingsService>(SettingsService);
    dispatchesService = module.get<DispatchesService>(DispatchesService);
    triggersService = module.get<TriggersService>(TriggersService);
    hub = module.get<Hub>(Hub);
    logger = module.get<Logger>(Logger);

    spyOnSettingsServiceUpdate = jest.spyOn(settingsService, 'update');
  });

  afterEach(async () => {
    spyOnSettingsServiceUpdate.mockReset();
  });

  afterAll(async () => {
    await module.close();
  });

  it('should call handleUpdateClientSettings', async () => {
    const settings = generateClientSettings();
    spyOnSettingsServiceUpdate.mockResolvedValueOnce(settings);

    await service.handleUpdateClientSettings({
      ...settings,
      type: InnerQueueTypes.updateClientSettings,
    });
    expect(spyOnSettingsServiceUpdate).toBeCalledWith(settings);
  });

  describe('handleCreateDispatch', () => {
    let spyOnDispatchesServiceUpdate: SpyInstance;
    let spyOnTriggersServiceUpdate: SpyInstance;
    let spyOnError: SpyInstance;
    let spyOnHub: SpyInstance;

    beforeAll(() => {
      spyOnDispatchesServiceUpdate = jest.spyOn(dispatchesService, 'update');
      spyOnTriggersServiceUpdate = jest.spyOn(triggersService, 'update');
      spyOnError = jest.spyOn(logger, 'error');
      spyOnHub = jest.spyOn(hub, 'notify');
    });

    afterEach(() => {
      spyOnDispatchesServiceUpdate.mockReset();
      spyOnTriggersServiceUpdate.mockReset();
      spyOnError.mockReset();
      spyOnHub.mockReset();
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
      expect(spyOnHub).not.toBeCalled();
      expect(spyOnError).toBeCalledWith(
        createDispatch,
        ConductorService.name,
        'handleCreateDispatch',
      );
    });

    it(`should handle triggeredAt within the past/future ${gapTriggeredAt} seconds`, async () => {
      const createDispatch = generateDispatch({
        triggeredAt: subSeconds(new Date(), gapTriggeredAt),
      });
      spyOnDispatchesServiceUpdate.mockResolvedValueOnce(createDispatch);

      await service.handleCreateDispatch({
        ...createDispatch,
        type: InnerQueueTypes.createDispatch,
      });

      expect(new Date().getTime()).toBeGreaterThan(createDispatch.triggeredAt.getTime());
      expect(spyOnDispatchesServiceUpdate).toBeCalledWith(createDispatch);
      expect(spyOnTriggersServiceUpdate).not.toBeCalled();
      expect(spyOnHub).toBeCalledWith(createDispatch);
      expect(spyOnError).not.toBeCalled();
    });

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
      expect(spyOnHub).not.toBeCalled();
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
