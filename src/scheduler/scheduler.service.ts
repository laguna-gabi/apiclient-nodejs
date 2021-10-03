import { Injectable } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import {
  Errors,
  ErrorType,
  Identifier,
  Logger,
  EventType,
  NotificationType,
  NotifyParams,
  NotifyParamsDocument,
} from '../common';
import { cloneDeep } from 'lodash';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Appointment, AppointmentDocument, AppointmentStatus } from '../appointment';
import { Bitly } from '../providers';
import { CommunicationResolver } from '../communication';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as config from 'config';

@Injectable()
export class SchedulerService {
  private logger = new Logger(SchedulerService.name);

  constructor(
    @InjectModel(NotifyParams.name)
    private readonly notifyParamsModel: Model<NotifyParamsDocument>,
    @InjectModel(Appointment.name)
    private readonly appointmentModel: Model<AppointmentDocument>,
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly communicationResolver: CommunicationResolver,
    private readonly bitly: Bitly,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async init() {
    await this.initRegisterCustomFutureNotify();
    await this.initRegisterAppointmentAlert();
  }

  /*************************************************************************************************
   ********************************************* Public ********************************************
   ************************************************************************************************/

  public async registerCustomFutureNotify(
    notifyParams: NotifyParams,
  ): Promise<Identifier | undefined> {
    const { _id: id } = await this.notifyParamsModel.create(notifyParams);
    const delayTime = notifyParams.metadata.when.getTime() - Date.now();
    if (delayTime < 0) {
      throw new Error(Errors.get(ErrorType.notificationMetadataWhenPast));
    }

    const { maxDate } = this.getCurrentDateConfigs();
    if (notifyParams.metadata.when.getTime() <= maxDate.getTime()) {
      const notifyParamsDuplicated = cloneDeep(notifyParams);
      delete notifyParamsDuplicated.metadata.when;

      const timeout = setTimeout(async () => {
        this.eventEmitter.emit(EventType.notify, notifyParamsDuplicated);
        this.deleteTimeout({ id });
      }, delayTime);
      this.schedulerRegistry.addTimeout(id, timeout);

      return { id };
    }
  }

  public async registerAppointmentAlert({
    id,
    memberId,
    userId,
    start,
  }: {
    id: string;
    memberId: string;
    userId: string;
    start: Date;
  }): Promise<void> {
    this.deleteTimeout({ id });

    const { gapDate, maxDate } = this.getCurrentDateConfigs();

    if (start.getTime() <= maxDate.getTime()) {
      this.scheduleAppointmentAlert({ id, memberId, userId, start, gapDate });
    }
  }

  public deleteTimeout({ id }: { id: string }) {
    if (this.schedulerRegistry.doesExists('timeout', id)) {
      this.schedulerRegistry.deleteTimeout(id);
    }
  }

  /*************************************************************************************************
   ******************************************** Internals ******************************************
   ************************************************************************************************/
  private scheduleAppointmentAlert({
    id,
    memberId,
    userId,
    start,
    gapDate,
  }: {
    id: string;
    memberId: string;
    userId: string;
    start: Date;
    gapDate: Date;
  }) {
    const milliseconds = start.getTime() - gapDate.getTime();
    if (milliseconds > 0) {
      const timeout = setTimeout(async () => {
        this.logger.log(
          `${id}: notifying appointment reminder`,
          this.scheduleAppointmentAlert.name,
        );

        const chatLink = await this.getChatLink(memberId, userId);
        if (!chatLink) {
          return;
        }
        const metadata = {
          content: `${config
            .get('contents.appointmentReminder')
            .replace('@gapMinutes@', config.get('scheduler.alertBeforeInMin'))
            .replace('@chatLink@', chatLink)}`,
        };
        const params: NotifyParams = { memberId, userId, type: NotificationType.text, metadata };

        this.eventEmitter.emit(EventType.notify, params);
        this.schedulerRegistry.deleteTimeout(id);
      }, milliseconds);
      this.schedulerRegistry.addTimeout(id, timeout);
    }
  }

  /************************************************************************************************
   ******************************************* Initializers ***************************************
   ************************************************************************************************/

  private async initRegisterCustomFutureNotify() {
    const { maxDate } = this.getCurrentDateConfigs();
    const notifications = await this.notifyParamsModel
      .find({ 'metadata.when': { $gte: new Date(), $lte: maxDate } })
      .sort({ 'metadata.when': -1 });
    await Promise.all(
      notifications.map(async (notification) => {
        return this.registerCustomFutureNotify(notification);
      }),
    );
    this.logger.log(
      `Finish init scheduler for ${notifications.length} future notifications`,
      this.initRegisterCustomFutureNotify.name,
    );
  }
  private async initRegisterAppointmentAlert() {
    const { gapDate, maxDate } = this.getCurrentDateConfigs();
    const appointments = await this.appointmentModel
      .find({ status: AppointmentStatus.scheduled, start: { $gte: gapDate, $lte: maxDate } })
      .sort({ start: 1 });
    appointments.map((appointment) => {
      this.scheduleAppointmentAlert({
        id: appointment._id,
        memberId: appointment.memberId.toString(),
        userId: appointment.userId,
        start: appointment.start,
        gapDate,
      });
    });
    this.logger.log(
      `Finish init scheduler for ${appointments.length} appointments`,
      this.initRegisterAppointmentAlert.name,
    );
  }

  /*************************************************************************************************
   ******************************************** Helpers ********************************************
   ************************************************************************************************/

  /**
   * Setting max alert time for 2 months to avoid alerting the max integer allowed in setTimeout.
   * Avoiding error: TimeoutOverflowWarning: 6988416489 does not fit into a 32-bit signed integer
   */
  private getCurrentDateConfigs(): { gapDate: Date; maxDate: Date } {
    const gapDate = new Date();
    gapDate.setMinutes(gapDate.getMinutes() + config.get('scheduler.alertBeforeInMin'));
    const maxDate = new Date();
    maxDate.setMinutes(maxDate.getMinutes() + config.get('scheduler.maxAlertGapInMin'));

    return { gapDate, maxDate };
  }

  private async getChatLink(memberId: string, userId: string) {
    const communication = await this.communicationResolver.getCommunication({ memberId, userId });
    if (!communication) {
      console.warn(
        `NOT sending appointment reminder since no member-user communication exists ` +
          `for member ${memberId} and user ${userId}`,
      );
      return;
    }
    return this.bitly.shortenLink(communication.chat.memberLink);
  }
}
