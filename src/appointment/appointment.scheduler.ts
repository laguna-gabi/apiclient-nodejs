import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { SchedulerRegistry } from '@nestjs/schedule';
import * as config from 'config';
import { add, sub } from 'date-fns';
import { Model } from 'mongoose';
import { Appointment, AppointmentDocument, AppointmentStatus } from '.';
import {
  ContentKey,
  ErrorType,
  Errors,
  EventType,
  InternalNotifyParams,
  Logger,
  ReminderType,
} from '../common';
import { CommunicationResolver } from '../communication';
import { Bitly } from '../providers';
import { BaseScheduler, InternalSchedulerService, LeaderType } from '../scheduler';
import { InternalNotificationType } from '@lagunahealth/pandora';

@Injectable()
export class AppointmentScheduler extends BaseScheduler {
  constructor(
    protected readonly internalSchedulerService: InternalSchedulerService,
    @InjectModel(Appointment.name)
    private readonly appointmentModel: Model<AppointmentDocument>,
    private readonly communicationResolver: CommunicationResolver,
    protected readonly schedulerRegistry: SchedulerRegistry,
    protected eventEmitter: EventEmitter2,
    protected readonly bitly: Bitly,
    protected readonly logger: Logger,
  ) {
    super(
      internalSchedulerService,
      schedulerRegistry,
      eventEmitter,
      bitly,
      LeaderType.appointment,
      AppointmentScheduler.name,
      logger,
    );
  }

  async init() {
    await super.init(async () => {
      await this.initRegisterAppointmentAlert();
      await this.initRegisterAppointmentLongAlert();
    });
  }

  /*************************************************************************************************
   ********************************************* Public ********************************************
   ************************************************************************************************/

  async registerAppointmentAlert({
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
    await this.unRegisterAppointmentAlert(id);
    const { gapDate, maxDate } = this.getCurrentDateConfigs();

    if (start.getTime() <= maxDate.getTime()) {
      this.scheduleAppointmentAlert({
        id: id + ReminderType.appointmentReminder,
        memberId,
        userId,
        start,
        gapDate,
      });
      this.scheduleAppointmentLongAlert({
        id: id + ReminderType.appointmentLongReminder,
        memberId,
        userId,
        start,
      });
    }
  }

  public async unRegisterAppointmentAlert(id: string) {
    await this.deleteTimeout({ id: id + ReminderType.appointmentReminder });
    await this.deleteTimeout({ id: id + ReminderType.appointmentLongReminder });
  }

  /************************************************************************************************
   ******************************************* Initializers ***************************************
   ************************************************************************************************/

  private async initRegisterAppointmentAlert() {
    const { gapDate, maxDate } = this.getCurrentDateConfigs();
    const appointments = await this.appointmentModel
      .find({ status: AppointmentStatus.scheduled, start: { $gte: gapDate, $lte: maxDate } })
      .sort({ start: 1 });
    await Promise.all(
      appointments.map(async (appointment) => {
        return this.scheduleAppointmentAlert({
          id: appointment._id + ReminderType.appointmentReminder,
          memberId: appointment.memberId.toString(),
          userId: appointment.userId,
          start: appointment.start,
          gapDate,
        });
      }),
    );
    this.logEndInit(
      appointments.length,
      'appointments reminders',
      this.initRegisterAppointmentAlert.name,
    );
  }

  private async initRegisterAppointmentLongAlert() {
    const { maxDate } = this.getCurrentDateConfigs();
    const appointments = await this.appointmentModel
      .find({
        status: AppointmentStatus.scheduled,
        start: { $gte: add(new Date(), { days: 1 }), $lte: maxDate },
      })
      .sort({ start: 1 });
    await Promise.all(
      appointments.map(async (appointment) => {
        return this.scheduleAppointmentLongAlert({
          id: appointment._id + ReminderType.appointmentLongReminder,
          memberId: appointment.memberId.toString(),
          userId: appointment.userId,
          start: appointment.start,
        });
      }),
    );
    this.logEndInit(
      appointments.length,
      'appointments long reminders',
      this.initRegisterAppointmentLongAlert.name,
    );
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
        this.logger.debug(
          { id, memberId, userId, start, gapDate },
          this.className,
          this.scheduleAppointmentAlert.name,
        );

        const chatLink = await this.getChatLink(memberId, userId);
        if (!chatLink) {
          return;
        }
        const params: InternalNotifyParams = {
          memberId,
          userId,
          type: InternalNotificationType.textToMember,
          metadata: {
            contentType: ContentKey.appointmentReminder,
            extraData: { gapMinutes: config.get('scheduler.alertBeforeInMin') },
            chatLink,
            checkAppointmentReminder: true,
          },
        };

        this.eventEmitter.emit(EventType.notifyInternal, params);
        this.deleteTimeout({ id });
      }, milliseconds);
      this.addTimeout(id, timeout);
    }
  }

  private scheduleAppointmentLongAlert({
    id,
    memberId,
    userId,
    start,
  }: {
    id: string;
    memberId: string;
    userId: string;
    start: Date;
  }) {
    const milliseconds = sub(start, { days: 1 }).getTime() - Date.now();
    if (milliseconds > 0) {
      const timeout = setTimeout(async () => {
        this.logger.debug(
          { id, memberId, userId, start },
          this.className,
          this.scheduleAppointmentLongAlert.name,
        );
        const params: InternalNotifyParams = {
          memberId,
          userId,
          type: InternalNotificationType.textToMember,
          metadata: {
            contentType: ContentKey.appointmentLongReminder,
            appointmentTime: start,
            checkAppointmentReminder: true,
          },
        };

        this.eventEmitter.emit(EventType.notifyInternal, params);
        this.deleteTimeout({ id });
      }, milliseconds);
      this.schedulerRegistry.addTimeout(id, timeout);
    }
  }

  /*************************************************************************************************
   ******************************************** Helpers ********************************************
   ************************************************************************************************/

  private async getChatLink(memberId: string, userId: string) {
    const communication = await this.communicationResolver.getCommunication({ memberId, userId });
    if (!communication) {
      this.logger.warn(
        { memberId, userId },
        this.className,
        AppointmentScheduler.name,
        Errors.get(ErrorType.communicationMemberUserNotFound),
      );
      return;
    }
    return this.bitly.shortenLink(communication.chat.memberLink);
  }
}
