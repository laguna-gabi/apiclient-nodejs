import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { SchedulerRegistry } from '@nestjs/schedule';
import { add } from 'date-fns';
import { Model } from 'mongoose';
import {
  MemberConfig,
  MemberConfigDocument,
  MemberService,
  NotifyParams,
  NotifyParamsDocument,
} from '.';
import {
  ErrorType,
  Errors,
  EventType,
  Identifier,
  InternalNotifyParams,
  LoggerService,
  ReminderType,
} from '../common';
import { Bitly } from '../providers';
import { BaseScheduler, InternalSchedulerService, LeaderType } from '../scheduler';
import { ContentKey, InternalNotificationType, NotificationType } from '@lagunahealth/pandora';

@Injectable()
export class MemberScheduler extends BaseScheduler {
  constructor(
    protected readonly internalSchedulerService: InternalSchedulerService,
    @InjectModel(NotifyParams.name)
    private readonly notifyParamsModel: Model<NotifyParamsDocument>,
    @InjectModel(MemberConfig.name)
    private readonly memberConfigModel: Model<MemberConfigDocument>,
    protected readonly schedulerRegistry: SchedulerRegistry,
    protected readonly eventEmitter: EventEmitter2,
    protected readonly bitly: Bitly,
    private readonly memberService: MemberService,
    protected readonly logger: LoggerService,
  ) {
    super(
      internalSchedulerService,
      schedulerRegistry,
      eventEmitter,
      bitly,
      LeaderType.member,
      MemberScheduler.name,
      logger,
    );
  }

  async init() {
    await super.init(async () => {
      await this.initRegisterCustomFutureNotify();
      await this.initRegisterLogReminder();
    });
  }

  /*************************************************************************************************
   ********************************************* Public ********************************************
   ************************************************************************************************/

  public async registerCustomFutureNotify(
    notifyParams: NotifyParams,
  ): Promise<Identifier | undefined> {
    const { memberId, userId, type, metadata } = notifyParams;
    const { _id: id } = await this.notifyParamsModel.create(notifyParams);
    const delayTime = notifyParams.metadata.when.getTime() - Date.now();
    if (delayTime < 0) {
      throw new Error(Errors.get(ErrorType.notificationMetadataWhenPast));
    }

    const { maxDate } = this.getCurrentDateConfigs();
    if (notifyParams.metadata.when.getTime() <= maxDate.getTime()) {
      const params: InternalNotifyParams = {
        memberId,
        userId,
        type:
          type === NotificationType.text
            ? InternalNotificationType.textToMember
            : InternalNotificationType.textSmsToMember,
        metadata: {},
        content: metadata.content,
      };

      const timeout = setTimeout(async () => {
        this.eventEmitter.emit(EventType.notifyInternal, params);
        this.deleteTimeout({ id });
      }, delayTime);
      this.addTimeout(id, timeout);

      return { id };
    }
  }

  public async registerLogReminder({
    memberId,
    userId,
    firstLoggedInAt,
  }: {
    memberId: string;
    userId: string;
    firstLoggedInAt: Date;
  }) {
    const milliseconds = add(firstLoggedInAt, { days: 3 }).getTime() - Date.now();
    if (milliseconds > 0) {
      const timeout = setTimeout(async () => {
        this.logger.debug(
          { memberId, userId, firstLoggedInAt },
          MemberScheduler.name,
          this.registerLogReminder.name,
        );
        const params: InternalNotifyParams = {
          memberId,
          userId,
          type: InternalNotificationType.textToMember,
          metadata: { contentType: ContentKey.logReminder },
        };
        this.eventEmitter.emit(EventType.notifyInternal, params);
        this.deleteTimeout({ id: memberId + ReminderType.logReminder });
      }, milliseconds);
      this.schedulerRegistry.addTimeout(memberId + ReminderType.logReminder, timeout);
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
    this.logEndInit(
      notifications.length,
      'member future notifications',
      this.initRegisterCustomFutureNotify.name,
    );
  }

  private async initRegisterLogReminder() {
    const newRegisteredMembers =
      await this.memberService.getNewRegisteredMembersWithNoDailyReports();
    await Promise.all(
      newRegisteredMembers.map(async ({ memberConfig, member }) => {
        return this.registerLogReminder({
          memberId: member.id,
          userId: member.primaryUserId,
          firstLoggedInAt: memberConfig.firstLoggedInAt,
        });
      }),
    );
    this.logEndInit(
      newRegisteredMembers.length,
      'new registered members log reminder',
      this.initRegisterLogReminder.name,
    );
  }
}
