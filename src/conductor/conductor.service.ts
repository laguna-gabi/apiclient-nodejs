import { ICreateDispatch, IDeleteDispatch, IUpdateClientSettings } from '@lagunahealth/pandora';
import { Injectable } from '@nestjs/common';
import { gapTriggeredAt } from 'config';
import { differenceInSeconds } from 'date-fns';
import { Logger } from '../common';
import { DispatchStatus, DispatchesService, Hub, TriggersService } from '.';
import { SettingsService } from '../settings';

@Injectable()
export class ConductorService {
  constructor(
    private readonly logger: Logger,
    private readonly settingsService: SettingsService,
    private readonly dispatchesService: DispatchesService,
    private readonly triggersService: TriggersService,
    private readonly hub: Hub,
  ) {}

  async handleUpdateClientSettings(input: IUpdateClientSettings): Promise<void> {
    this.logger.debug(input, ConductorService.name, this.handleUpdateClientSettings.name);
    const settings = this.cleanObject(input);
    await this.settingsService.update(settings);
  }

  async handleCreateDispatch(input: ICreateDispatch): Promise<void> {
    this.logger.debug(input, ConductorService.name, this.handleCreateDispatch.name);
    const dispatch = this.cleanObject(input);

    await this.dispatchesService.update({ ...dispatch, status: DispatchStatus.received });

    const currentMinusInput = differenceInSeconds(new Date(), dispatch.triggeredAt);
    if (currentMinusInput >= -1 * gapTriggeredAt && currentMinusInput <= gapTriggeredAt) {
      //real time event
      await this.dispatchesService.internalUpdate({
        dispatchId: dispatch.dispatchId,
        status: DispatchStatus.acquired,
      });
      await this.hub.notify(dispatch);
    } else if (currentMinusInput > gapTriggeredAt) {
      //past event
      this.logger.error(dispatch, ConductorService.name, this.handleCreateDispatch.name);
    } else {
      //future event
      await this.triggersService.update({
        dispatchId: dispatch.dispatchId,
        expiresAt: dispatch.triggeredAt,
      });
    }
  }

  async handleDeleteDispatch(input: IDeleteDispatch): Promise<void> {
    this.logger.debug(input, ConductorService.name, this.handleDeleteDispatch.name);
    const dispatch = this.cleanObject(input);
    const result = await this.dispatchesService.internalUpdate({
      dispatchId: dispatch.dispatchId,
      status: DispatchStatus.canceled,
    });

    if (!result) {
      this.logger.warn(dispatch, ConductorService.name, this.handleDeleteDispatch.name);
    }

    await this.triggersService.delete(dispatch.dispatchId);
  }

  private cleanObject(object) {
    const newObject = { ...object };
    delete newObject.type;

    return newObject;
  }
}
