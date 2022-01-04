import {
  CancelNotificationType,
  ICreateDispatch,
  IDeleteClientSettings,
  IDeleteDispatch,
  IUpdateClientSettings,
  formatEx,
} from '@lagunahealth/pandora';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { gapTriggersAt, retryMax } from 'config';
import { differenceInSeconds } from 'date-fns';
import { Dispatch, DispatchStatus, DispatchesService, TriggersService } from '.';
import { ErrorType, Errors, Logger } from '../common';
import { NotificationsService } from '../providers';
import { ClientSettings, SettingsService } from '../settings';

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
    this.logger.info(input, ConductorService.name, this.handleUpdateClientSettings.name);
    const settings = this.cleanObject(input);
    await this.settingsService.update(settings);
  }

  async handleDeleteClientSettings(input: IDeleteClientSettings): Promise<void> {
    this.logger.info(input, ConductorService.name, this.handleDeleteClientSettings.name);
    const settings = this.cleanObject(input);
    await this.settingsService.delete(settings.id);
  }

  async handleCreateDispatch(input: ICreateDispatch): Promise<void> {
    this.logger.info(input, ConductorService.name, this.handleCreateDispatch.name);
    const cleanObject: Dispatch = this.cleanObject(input);
    const dispatch = await this.dispatchesService.update({
      ...cleanObject,
      status: DispatchStatus.received,
    });
    const currentMinusInput = differenceInSeconds(new Date(), dispatch.triggersAt);
    if (Object.values(CancelNotificationType).some((type) => type === input.notificationType)) {
      await this.deleteExistingLiveDispatch(dispatch);
    } else if (
      !dispatch.triggersAt ||
      (currentMinusInput >= -1 * gapTriggersAt && currentMinusInput <= gapTriggersAt)
    ) {
      await this.createRealTimeDispatch(dispatch);
    } else if (currentMinusInput > gapTriggersAt) {
      //past event
      this.logger.warn(dispatch, ConductorService.name, this.handleCreateDispatch.name, {
        message: Errors.get(ErrorType.triggersAtPast),
      });
    } else {
      await this.registerFutureDispatch(dispatch);
    }
  }

  async handleDeleteDispatch(input: IDeleteDispatch): Promise<void> {
    this.logger.info(input, ConductorService.name, this.handleDeleteDispatch.name);
    const dispatch = this.cleanObject(input);
    const result = await this.dispatchesService.internalUpdate({
      dispatchId: dispatch.dispatchId,
      status: DispatchStatus.canceled,
    });

    if (!result) {
      this.logger.warn(dispatch, ConductorService.name, this.handleDeleteDispatch.name, {
        message: Errors.get(ErrorType.dispatchNotFound),
      });
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
      this.logger.info(
        { ...dispatch, failureReasons: undefined },
        ConductorService.name,
        this.createRealTimeDispatch.name,
      );
      dispatch = await this.dispatchesService.internalUpdate({
        dispatchId,
        status: DispatchStatus.acquired,
      });
      const recipientClient = await this.getRecipientClient(dispatch.recipientClientId);
      const senderClient = await this.settingsService.get(dispatch.senderClientId);
      const providerResult = await this.notificationsService.send(
        dispatch,
        recipientClient,
        senderClient,
      );
      await this.dispatchesService.internalUpdate({
        dispatchId,
        sentAt: new Date(),
        status: DispatchStatus.done,
        providerResult,
      });
    } catch (ex) {
      if (dispatch.retryCount <= retryMax) {
        //TODO NOT all dispatches should retry: call? sendbird? etc..)
        dispatch.failureReasons.push({ message: ex.message, stack: ex.stack });
        dispatch = await this.dispatchesService.internalUpdate({
          dispatchId: dispatch.dispatchId,
          failureReasons: dispatch.failureReasons,
          status: DispatchStatus.error,
          retryCount: dispatch.retryCount + 1,
        });
        const { failureReasons, ...dispatchParams } = dispatch;
        this.logger.warn(
          dispatchParams,
          ConductorService.name,
          this.createRealTimeDispatch.name,
          failureReasons[failureReasons.length - 1], // log only the last error
        );
        //TODO use more sophisticated retry mechanism - maybe try 2,5,7 seconds or a better logic
        setTimeout(
          async (dispatchInput) => {
            await this.createRealTimeDispatch(dispatchInput);
          },
          2000,
          dispatch,
        );
      } else {
        const { failureReasons, ...dispatchParams } = dispatch;
        this.logger.error(
          dispatchParams,
          ConductorService.name,
          this.createRealTimeDispatch.name,
          failureReasons[failureReasons.length - 1], // log only the last error
        );
      }
    }
  }

  private async registerFutureDispatch(dispatch: Dispatch) {
    this.logger.info(dispatch, ConductorService.name, this.registerFutureDispatch.name);
    const { _id } = await this.triggersService.update({
      dispatchId: dispatch.dispatchId,
      expireAt: dispatch.triggersAt,
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
      this.logger.warn({ triggeredId }, ConductorService.name, methodName, {
        message: Errors.get(ErrorType.triggeredIdNotFound),
      });
    } else {
      this.logger.info({ triggeredId }, ConductorService.name, methodName);
      await this.createRealTimeDispatch(dispatch);
    }
  }

  private async deleteExistingLiveDispatch(dispatch: Dispatch) {
    this.logger.info(dispatch, ConductorService.name, this.deleteExistingLiveDispatch.name);
    try {
      const recipientClient = await this.getRecipientClient(dispatch.recipientClientId);
      const providerResult = await this.notificationsService.cancel({
        platform: recipientClient.platform,
        externalUserId: recipientClient.externalUserId,
        data: {
          type: dispatch.notificationType as CancelNotificationType,
          peerId: dispatch.peerId,
          notificationId: dispatch.notificationId,
        },
      });

      await this.dispatchesService.internalUpdate({
        dispatchId: dispatch.dispatchId,
        sentAt: new Date(),
        status: DispatchStatus.done,
        providerResult,
      });
    } catch (ex) {
      this.logger.error(
        dispatch,
        ConductorService.name,
        this.deleteExistingLiveDispatch.name,
        formatEx(ex),
      );
    }
  }

  private async getRecipientClient(recipientClientId: string): Promise<ClientSettings> {
    const recipientClient = await this.settingsService.get(recipientClientId);
    if (!recipientClient) {
      throw new Error(Errors.get(ErrorType.recipientClientNotFound));
    }

    return recipientClient;
  }
}
