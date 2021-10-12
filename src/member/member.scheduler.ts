import { Injectable } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { NotifyParams, NotifyParamsDocument } from './member.dto';
import { Errors, ErrorType, EventType, Identifier, Logger, NotificationType } from '../common';
import { cloneDeep } from 'lodash';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MemberConfig, MemberConfigDocument, MemberService } from '.';
import { Bitly } from '../providers';
import { BaseScheduler, InternalSchedulerService, LeaderType } from '../scheduler';
import { add } from 'date-fns';
import * as config from 'config';

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
    protected readonly logger: Logger,
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
      await this.initRegisterNewMemberNudge();
      await this.initRegisterNewRegisteredMemberNotify();
      await this.initRegisterNewRegisteredMemberNudgeNotify();
    });
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
      this.addTimeout(id, timeout);

      return { id };
    }
  }

  public async registerNewRegisteredMemberNotify({
    memberId,
    userId,
    firstLoggedInAt,
  }: {
    memberId: string;
    userId: string;
    firstLoggedInAt: Date;
  }) {
    const milliseconds = add(firstLoggedInAt, { days: 1 }).getTime() - Date.now();
    if (milliseconds > 0) {
      const timeout = setTimeout(async () => {
        this.logger.debug(
          { memberId, userId, firstLoggedInAt },
          this.className,
          MemberScheduler.name,
        );
        const metadata = {
          content: `${config.get('contents.newRegisteredMember')}`,
        };
        const params: NotifyParams = { memberId, userId, type: NotificationType.text, metadata };

        this.eventEmitter.emit(EventType.notify, params);
        this.deleteTimeout({ id: memberId });
        await this.registerNewRegisteredMemberNudgeNotify({ memberId, userId, firstLoggedInAt });
      }, milliseconds);
      this.schedulerRegistry.addTimeout(memberId, timeout);
    }
  }

  public async registerNewRegisteredMemberNudgeNotify({
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
          this.registerNewRegisteredMemberNudgeNotify.name,
        );
        const metadata = {
          content: `${config.get('contents.newRegisteredMemberNudge')}`,
        };
        const params: NotifyParams = { memberId, userId, type: NotificationType.text, metadata };

        this.eventEmitter.emit(EventType.notify, params);
        this.deleteTimeout({ id: memberId });
      }, milliseconds);
      this.schedulerRegistry.addTimeout(memberId, timeout);
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

  private async initRegisterNewMemberNudge() {
    const newUnregisteredMembers = await this.memberService.getNewUnregisteredMembers();
    newUnregisteredMembers.map(async ({ member, user, appointmentId }) => {
      await this.registerNewMemberNudge({
        member,
        user,
        appointmentId,
      });
    });
    this.logEndInit(
      newUnregisteredMembers.length,
      'new member nudge',
      this.initRegisterNewMemberNudge.name,
    );
  }

  private async initRegisterNewRegisteredMemberNotify() {
    const newRegisteredMembers = await this.memberService.getNewRegisteredMembers({ nudge: false });
    await Promise.all(
      newRegisteredMembers.map(async ({ memberConfig, member }) => {
        return this.registerNewRegisteredMemberNotify({
          memberId: member.id,
          userId: member.primaryUserId,
          firstLoggedInAt: memberConfig.firstLoggedInAt,
        });
      }),
    );
    this.logEndInit(
      newRegisteredMembers.length,
      'new registered members',
      this.initRegisterNewRegisteredMemberNotify.name,
    );
  }

  private async initRegisterNewRegisteredMemberNudgeNotify() {
    const newRegisteredMembers = await this.memberService.getNewRegisteredMembers({ nudge: true });
    await Promise.all(
      newRegisteredMembers.map(async ({ memberConfig, member }) => {
        return this.registerNewRegisteredMemberNudgeNotify({
          memberId: member.id,
          userId: member.primaryUserId,
          firstLoggedInAt: memberConfig.firstLoggedInAt,
        });
      }),
    );
    this.logEndInit(
      newRegisteredMembers.length,
      'new registered members nudge',
      this.initRegisterNewRegisteredMemberNudgeNotify.name,
    );
  }
}
