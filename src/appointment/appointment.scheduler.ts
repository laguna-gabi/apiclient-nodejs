import { Injectable } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Appointment, AppointmentDocument, AppointmentStatus } from '.';
import { Model } from 'mongoose';
import { EventType, Logger, NotificationType } from '../common';
import { Bitly, NotificationsService } from '../providers';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NotifyParams } from '../member';
import * as config from 'config';
import { CommunicationService } from '../communication';
import { BaseScheduler, InternalSchedulerService, LeaderType } from '../scheduler';

@Injectable()
export class AppointmentScheduler extends BaseScheduler {
  private readonly logger = new Logger(AppointmentScheduler.name);

  constructor(
    protected readonly internalSchedulerService: InternalSchedulerService,
    @InjectModel(Appointment.name)
    private readonly appointmentModel: Model<AppointmentDocument>,
    private readonly notificationsService: NotificationsService,
    private readonly communicationService: CommunicationService,
    protected readonly schedulerRegistry: SchedulerRegistry,
    protected eventEmitter: EventEmitter2,
    protected readonly bitly: Bitly,
  ) {
    super(internalSchedulerService, schedulerRegistry, eventEmitter, bitly, LeaderType.appointment);
  }

  async init() {
    await super.init(async () => await this.initRegisterAppointmentAlert());
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
    this.deleteTimeout({ id });

    const { gapDate, maxDate } = this.getCurrentDateConfigs();

    if (start.getTime() <= maxDate.getTime()) {
      this.scheduleAppointmentAlert({ id, memberId, userId, start, gapDate });
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
            .replace('@gapMinutes@', config.get('scheduler.alertBeforeInMin'))
            .replace('@chatLink@', chatLink)}`,
        };
        const params: NotifyParams = { memberId, userId, type: NotificationType.text, metadata };

        this.eventEmitter.emit(EventType.notify, params);
        this.deleteTimeout({ id });
      }, milliseconds);
      this.addTimeout(id, timeout);
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
