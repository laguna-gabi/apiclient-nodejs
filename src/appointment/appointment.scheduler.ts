import { Injectable } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Appointment, AppointmentDocument, AppointmentStatus } from '.';
import { Model } from 'mongoose';
import { EventType, log, NotificationType } from '../common';
import { Bitly, NotificationsService } from '../providers';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NotifyParams } from '../member';
import * as config from 'config';
import { CommunicationResolver } from '../communication';

@Injectable()
export class AppointmentScheduler {
  constructor(
    @InjectModel(Appointment.name)
    private readonly appointmentModel: Model<AppointmentDocument>,
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly notificationsService: NotificationsService,
    private readonly communicationResolver: CommunicationResolver,
    private readonly bitly: Bitly,
    private eventEmitter: EventEmitter2,
  ) {}

  async init() {
    const { gapDate, maxDate } = this.generateDateConfigs();

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

    log(`Finish init scheduler for ${appointments.length} appointments`, AppointmentScheduler.name);
  }

  async updateAppointmentAlert({
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
    this.deleteAppointmentAlert({ id });

    const { gapDate, maxDate } = this.generateDateConfigs();

    if (start.getTime() <= maxDate.getTime()) {
      this.scheduleAppointmentAlert({ id, memberId, userId, start, gapDate });
    }
  }

  deleteAppointmentAlert({ id }: { id: string }) {
    if (this.schedulerRegistry.doesExists('timeout', id)) {
      this.schedulerRegistry.deleteTimeout(id);
    }
  }

  /*************************************************************************************************
   ******************************************** Internals ******************************************
   ************************************************************************************************/
  /**
   * Setting max alert time for 2 months to avoid alerting the max integer allowed in setTimeout.
   * Avoiding error: TimeoutOverflowWarning: 6988416489 does not fit into a 32-bit signed integer
   */
  private generateDateConfigs(): { gapDate: Date; maxDate: Date } {
    const gapDate = new Date();
    gapDate.setMinutes(gapDate.getMinutes() + config.get('appointments.alertBeforeInMin'));
    const maxDate = new Date();
    maxDate.setMinutes(maxDate.getMinutes() + config.get('appointments.maxAlertGapInMin'));

    return { gapDate, maxDate };
  }

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
        log(`${id}: notifying appointment reminder`, AppointmentScheduler.name);

        const chatLink = await this.getChatLink(memberId, userId);
        if (!chatLink) {
          return;
        }
        const metadata = {
          content: `${config
            .get('contents.appointmentReminder')
            .replace('@gapMinutes@', config.get('appointments.alertBeforeInMin'))
            .replace('@chatLink@', chatLink)}`,
        };
        const params: NotifyParams = { memberId, userId, type: NotificationType.text, metadata };

        this.eventEmitter.emit(EventType.notify, params);
        this.schedulerRegistry.deleteTimeout(id);
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
      console.warn(
        `NOT sending appointment reminder since no member-user communication exists ` +
          `for member ${memberId} and user ${userId}`,
      );
      return;
    }
    return this.bitly.shortenLink(communication.chat.memberLink);
  }
}
