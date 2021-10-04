import { Injectable } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { NotifyParams, NotifyParamsDocument } from './member.dto';
import { BaseScheduler, Errors, ErrorType, EventType, Identifier, Logger } from '../common';
import { cloneDeep } from 'lodash';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class MemberScheduler extends BaseScheduler {
  private logger = new Logger(MemberScheduler.name);

  constructor(
    @InjectModel(NotifyParams.name)
    private readonly notifyParamsModel: Model<NotifyParamsDocument>,
    protected readonly schedulerRegistry: SchedulerRegistry,
    private eventEmitter: EventEmitter2,
  ) {
    super(schedulerRegistry);
  }

  async init() {
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
      MemberScheduler.name,
    );
  }

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
}
