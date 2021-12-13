import {
  ICreateDispatch,
  IDeleteClientSettings,
  IDeleteDispatch,
  IUpdateClientSettings,
} from '@lagunahealth/pandora';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { gapTriggeredAt, retryMax } from 'config';
import { differenceInSeconds } from 'date-fns';
import { Dispatch, DispatchStatus, DispatchesService, TriggersService } from '.';
import { Logger } from '../common';
import { NotificationsService } from '../providers';
import { SettingsService } from '../settings';

@Injectable()
export class ConductorService implements OnModuleInit {
  constructor(
    private readonly logger: Logger,
    private readonly settingsService: SettingsService,
    private readonly dispatchesService: DispatchesService,
    private readonly triggersService: TriggersService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async onModuleInit() {
    this.triggersService.onTriggeredCallback = this.handleFutureDispatchWasTriggered.bind(this);
  }

  async handleUpdateClientSettings(input: IUpdateClientSettings): Promise<void> {
    this.logger.debug(input, ConductorService.name, this.handleUpdateClientSettings.name);
    const settings = this.cleanObject(input);
    await this.settingsService.update(settings);
  }

  async handleDeleteClientSettings(input: IDeleteClientSettings): Promise<void> {
    this.logger.debug(input, ConductorService.name, this.handleDeleteClientSettings.name);
    const settings = this.cleanObject(input);
    await this.settingsService.delete(settings.id);
  }

  async handleCreateDispatch(input: ICreateDispatch): Promise<void> {
    this.logger.debug(input, ConductorService.name, this.handleCreateDispatch.name);
    const cleanObject: Dispatch = this.cleanObject(input);
    const dispatch = await this.dispatchesService.update({
      ...cleanObject,
      status: DispatchStatus.received,
    });
    const currentMinusInput = differenceInSeconds(new Date(), dispatch.triggeredAt);
    if (
      !dispatch.triggeredAt ||
      (currentMinusInput >= -1 * gapTriggeredAt && currentMinusInput <= gapTriggeredAt)
    ) {
      await this.createRealTimeDispatch(dispatch);
    } else if (currentMinusInput > gapTriggeredAt) {
      //past event
      this.logger.error(dispatch, ConductorService.name, this.handleCreateDispatch.name);
    } else {
      await this.registerFutureDispatch(dispatch);
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

  /*************************************************************************************************
   ******************************************** Helpers ********************************************
   ************************************************************************************************/

  private cleanObject(object) {
    const newObject = { ...object };
    delete newObject.type;
    return newObject;
  }

  private async createRealTimeDispatch(dispatch: Dispatch) {
    try {
      const { dispatchId } = dispatch;
      this.logger.debug(
        { ...dispatch, failureReasons: undefined },
        ConductorService.name,
        this.createRealTimeDispatch.name,
      );
      dispatch = await this.dispatchesService.internalUpdate({
        dispatchId,
        status: DispatchStatus.acquired,
      });
      const recipientClient = await this.settingsService.get(dispatch.recipientClientId);
      const senderClient = await this.settingsService.get(dispatch.senderClientId);
      await this.notificationsService.send(dispatch, recipientClient, senderClient);
      await this.dispatchesService.internalUpdate({
        dispatchId,
        sentAt: new Date(),
        status: DispatchStatus.done,
      });
    } catch (ex) {
      if (dispatch.retryCount <= retryMax) {
        //TODO NOT all dispatches should retry: call? cancelNotification? sendbird? etc..)
        dispatch.failureReasons.push({ message: ex.message, stack: ex.stack });
        dispatch = await this.dispatchesService.internalUpdate({
          dispatchId: dispatch.dispatchId,
          failureReasons: dispatch.failureReasons,
          status: DispatchStatus.error,
          retryCount: dispatch.retryCount + 1,
        });
        this.logger.warn(dispatch, ConductorService.name, this.createRealTimeDispatch.name);
        //TODO use more sophisticated retry mechanism - maybe try 2,5,7 seconds or a better logic
        setTimeout(
          async (dispatchInput) => {
            await this.createRealTimeDispatch(dispatchInput);
          },
          2000,
          dispatch,
        );
      } else {
        this.logger.error(dispatch, ConductorService.name, this.createRealTimeDispatch.name, ex);
      }
    }
  }

  private async registerFutureDispatch(dispatch: Dispatch) {
    this.logger.debug(dispatch, ConductorService.name, this.registerFutureDispatch.name);
    const { _id } = await this.triggersService.update({
      dispatchId: dispatch.dispatchId,
      expireAt: dispatch.triggeredAt,
    });
    await this.dispatchesService.internalUpdate({
      dispatchId: dispatch.dispatchId,
      triggeredId: _id.toString(),
    });
  }

  private async handleFutureDispatchWasTriggered(triggeredId: string): Promise<void> {
    const dispatch = await this.dispatchesService.find({ triggeredId });
    const methodName = this.handleFutureDispatchWasTriggered.name;
    if (!dispatch) {
      this.logger.error({ triggeredId }, ConductorService.name, methodName, 'not found');
    } else {
      this.logger.debug({ triggeredId }, ConductorService.name, methodName);
      await this.createRealTimeDispatch(dispatch);
    }
  }
}
