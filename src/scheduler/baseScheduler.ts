import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron, SchedulerRegistry } from '@nestjs/schedule';
import * as config from 'config';
import { add, secondsToMilliseconds } from 'date-fns';
import { v4 } from 'uuid';
import { InternalSchedulerService } from '.';
import {
  EventType,
  internalLogs,
  InternalNotificationType,
  InternalNotifyParams,
  Logger,
} from '../common';
import { Member } from '../member';
import { Bitly } from '../providers';
import { User } from '../user';
import Timeout = NodeJS.Timeout;

export enum LeaderType {
  appointment = 'appointment',
  member = 'member',
}

export class BaseScheduler {
  protected amITheLeader = false;
  protected readonly identifier = v4();
  initCallbacks: () => any;

  public constructor(
    protected readonly internalSchedulerService: InternalSchedulerService,
    protected readonly schedulerRegistry: SchedulerRegistry,
    protected readonly eventEmitter: EventEmitter2,
    protected readonly bitly: Bitly,
    protected readonly leaderType: LeaderType,
    protected readonly className: string,
    protected readonly logger: Logger,
  ) {}

  protected async init(callbacks) {
    this.initCallbacks = callbacks;
    /**
     * cron job doesn't start after 1 minute, but we want the initiation to happen at
     * the first moment the service is alive
     */
    await this.runEveryMinute();
  }

  public deleteTimeout({ id }: { id: string }) {
    if (this.schedulerRegistry.doesExists('timeout', id)) {
      this.schedulerRegistry.deleteTimeout(id);
    }
  }

  /**
   * Setting max alert time for 2 months to avoid alerting the max integer allowed in setTimeout.
   * Avoiding error: TimeoutOverflowWarning: 6988416489 does not fit into a 32-bit signed integer
   */
  protected getCurrentDateConfigs(): { gapDate: Date; maxDate: Date } {
    const gapDate = new Date();
    gapDate.setMinutes(gapDate.getMinutes() + config.get('scheduler.alertBeforeInMin'));
    const maxDate = new Date();
    maxDate.setMinutes(maxDate.getMinutes() + config.get('scheduler.maxAlertGapInMin'));

    return { gapDate, maxDate };
  }

  @Cron(`*/${config.get('scheduler.cronJobIntervalInMin')} * * * *`)
  async runEveryMinute() {
    if (this.amITheLeader) {
      await this.internalSchedulerService.updateLeader({
        id: this.identifier,
        leaderType: this.leaderType,
      });
    } else {
      //rolling number between [0,5] seconds: if 2 service start together, they'll both be leaders
      await new Promise((resolve) =>
        setTimeout(resolve, Math.floor(Math.random() * secondsToMilliseconds(5)) + 1),
      );
      const leader = await this.internalSchedulerService.getLeader(this.leaderType);
      if (!leader) {
        await this.internalSchedulerService.updateLeader({
          id: this.identifier,
          leaderType: this.leaderType,
        });
        this.amITheLeader = true;
        this.logger.internal(
          internalLogs.schedulerLeader
            .replace('@type@', this.leaderType)
            .replace('@identifier@', this.identifier),
          this.className,
          this.runEveryMinute.name,
        );
        await this.initCallbacks();
      }
    }
  }

  public async registerNewMemberNudge({
    member,
    user,
    appointmentId,
  }: {
    member: Member;
    user: User;
    appointmentId: string;
  }) {
    const memberId = member.id.toString();
    const milliseconds = add(member.createdAt, { days: 2 }).getTime() - new Date().getTime();
    if (milliseconds > 0) {
      const timeout = setTimeout(async () => {
        const url = await this.bitly.shortenLink(
          `${config.get('contents.newMemberNudge')}/download/${appointmentId}`,
        );

        const metadata = {
          content: `${config
            .get('contents.appointmentRequest')
            .replace('@downloadLink@', `\n${url}`)}`,
        };
        const params: InternalNotifyParams = {
          memberId,
          userId: user.id,
          type: InternalNotificationType.textSmsToMember,
          metadata,
        };
        this.eventEmitter.emit(EventType.internalNotify, params);
        this.deleteTimeout({ id: memberId });
      }, milliseconds);
      this.addTimeout(memberId, timeout);
    }
  }

  /**
   * Since we're running on multiple services at once, we might have a scerio like:
   * 1. service1 is the leaders
   * 2. service2 receives event for adding new member to schedule messages
   * 3. service1 crashes
   * 4. service2 takes ownership for being a leader
   * 5. service2 calls init and loads all the schedule notifications
   * 6. service2 already has the event for adding a new member, so the timeout already exists
   * For this scenario we're checking that the timeout id doesn't exists.
   * This handles this exception :
   *
   * Error: Timeout with the given name (615eb7b6874e0300276a400c) already exists. Ignored.
   * at SchedulerRegistry.addTimeout (@nestjs/schedule/dist/scheduler.registry.js:68:19)
   * at MemberScheduler.registerNewMemberNudge (baseScheduler.js:90:36)
   * at src/member/member.scheduler.js:77:18
   * at Array.map (<anonymous>)
   * at MemberScheduler.initRegisterNewMemberNudge (src/member/member.scheduler.js:75:32)
   * at processTicksAndRejections (node:internal/process/task_queues:96:5)
   * at async MemberScheduler.initCallbacks (src/member/member.scheduler.js:42:13)
   * at async MemberScheduler.runEveryMinute (src/scheduler/baseScheduler.js:64:17)
   */
  protected addTimeout(id: string, timeout: Timeout) {
    if (!this.schedulerRegistry.doesExists('timeout', id)) {
      this.schedulerRegistry.addTimeout(id, timeout);
    }
  }

  protected logEndInit(lengthResults: number, customText, methodName: string) {
    this.logger.debug(
      {
        schedulerIdentifier: this.identifier,
        lengthResults,
      },
      this.className,
      methodName,
    );
  }
}
