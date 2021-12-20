import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { SchedulerRegistry } from '@nestjs/schedule';
import { Model } from 'mongoose';
import { MemberConfig, MemberConfigDocument, NotifyParams, NotifyParamsDocument } from '.';
import {
  ErrorType,
  Errors,
  EventType,
  Identifier,
  InternalNotifyParams,
  LoggerService,
} from '../common';
import { Bitly } from '../providers';
import { BaseScheduler, InternalSchedulerService, LeaderType } from '../scheduler';
import { InternalNotificationType, NotificationType } from '@lagunahealth/pandora';

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
}
