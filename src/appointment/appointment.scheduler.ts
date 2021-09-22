import { Injectable } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Appointment, AppointmentDocument, AppointmentStatus } from '.';
import { Model } from 'mongoose';
import { EventType, NotificationType } from '../common';
import { NotificationsService } from '../providers';
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

    this.log(`Finish init scheduler for ${appointments.length} appointments`);
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
    if (this.schedulerRegistry.doesExists('timeout', id)) {
      this.schedulerRegistry.deleteTimeout(id);
    }

    const { gapDate, maxDate } = this.generateDateConfigs();

    if (start <= maxDate) {
      this.scheduleAppointmentAlert({ id, memberId, userId, start, gapDate });
    }
  }

  async deleteAppointmentAlert({ id }: { id: string }): Promise<void> {
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
        this.log(`${id}: notifying appointment reminder`);

        const communication = await this.communicationResolver.getCommunication({
          memberId,
          userId,
        });
        if (!communication) {
          console.warn(
            `NOT sending appointment reminder since no member-user communication exists ` +
              `for member ${memberId} and user ${userId}`,
          );
          return;
        }
        const metadata = {
          content: `${config
            .get('contents.appointmentReminder')
            .replace('@gapMinutes@', config.get('appointments.alertBeforeInMin'))
            .replace('@chatLink@', communication.chat.memberLink)}`,
        };
        const params: NotifyParams = { memberId, userId, type: NotificationType.text, metadata };

        this.eventEmitter.emit(EventType.notify, params);
        this.schedulerRegistry.deleteTimeout(id);
      }, milliseconds);
      this.schedulerRegistry.addTimeout(id, timeout);
    }
  }

  private log(text: string) {
    const now = new Date();
    console.debug(
      `${now.toLocaleDateString()}, ${now.toLocaleTimeString()}   [${
        AppointmentScheduler.name
      }] ${text}`,
    );
  }
}
