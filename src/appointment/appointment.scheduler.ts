import { Injectable } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Appointment, AppointmentDocument, AppointmentStatus } from '.';
import { Model } from 'mongoose';
import { ReminderType, EventType, Logger, NotificationType } from '../common';
import { Bitly } from '../providers';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NotifyParams } from '../member';
import * as config from 'config';
import { add, sub } from 'date-fns';
import { CommunicationService } from '../communication';
import { BaseScheduler, InternalSchedulerService, LeaderType } from '../scheduler';

@Injectable()
export class AppointmentScheduler extends BaseScheduler {
  private readonly logger = new Logger(AppointmentScheduler.name);

  constructor(
    protected readonly internalSchedulerService: InternalSchedulerService,
    @InjectModel(Appointment.name)
    private readonly appointmentModel: Model<AppointmentDocument>,
    private readonly communicationService: CommunicationService,
    protected readonly schedulerRegistry: SchedulerRegistry,
    protected eventEmitter: EventEmitter2,
    protected readonly bitly: Bitly,
  ) {
    super(internalSchedulerService, schedulerRegistry, eventEmitter, bitly, LeaderType.appointment);
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
    this.deleteTimeout({ id: id + ReminderType.appointmentReminder });
    this.deleteTimeout({ id: id + ReminderType.appointmentLongReminder });

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
    this.logger.log(
      `Finish init scheduler for ${appointments.length} appointments reminders`,
      AppointmentScheduler.name,
    );
  }

  private async initRegisterAppointmentLongAlert() {
    const { maxDate } = this.getCurrentDateConfigs();
    const longAppointments = await this.appointmentModel
      .find({
        status: AppointmentStatus.scheduled,
        start: { $gte: add(new Date(), { days: 1 }), $lte: maxDate },
      })
      .sort({ start: 1 });
    await Promise.all(
      longAppointments.map(async (appointment) => {
        return this.scheduleAppointmentLongAlert({
          id: appointment._id + ReminderType.appointmentLongReminder,
          memberId: appointment.memberId.toString(),
          userId: appointment.userId,
          start: appointment.start,
        });
      }),
    );
    this.logger.log(
      `Finish init scheduler for ${longAppointments.length} appointments long reminders`,
      AppointmentScheduler.name,
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
        this.logger.log(`${id}: notifying appointment reminder`, AppointmentScheduler.name);

        const chatLink = await this.getChatLink(memberId, userId);
        if (!chatLink) {
          return;
        }
        const metadata = {
          content: `${config
            .get('contents.appointmentReminder')
            .replace('@gapMinutes@', config.get('scheduler.alertBeforeInMin'))}`,
          chatLink: chatLink,
        };
        const params: NotifyParams = { memberId, userId, type: NotificationType.text, metadata };

        this.eventEmitter.emit(EventType.notify, params);
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
        this.logger.log(`${id}: notifying appointment long reminder`, AppointmentScheduler.name);
        const metadata = {
          content: `${config.get('contents.appointmentLongReminder')}`,
        };
        const params: NotifyParams = { memberId, userId, type: NotificationType.text, metadata };

        this.eventEmitter.emit(EventType.notify, params);
        this.deleteTimeout({ id });
      }, milliseconds);
      this.schedulerRegistry.addTimeout(id, timeout);
    }
  }

  /*************************************************************************************************
   ******************************************** Helpers ********************************************
   ************************************************************************************************/

  private async getChatLink(memberId: string, userId: string) {
    const communication = await this.communicationService.get({ memberId, userId });
    if (!communication) {
      this.logger.warn(
        `NOT sending appointment reminder since no member-user communication exists ` +
          `for member ${memberId} and user ${userId}`,
        AppointmentScheduler.name,
      );
      return;
    }
    return this.bitly.shortenLink(communication.chat.memberLink);
  }
}
