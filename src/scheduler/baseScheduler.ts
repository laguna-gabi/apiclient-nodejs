import * as config from 'config';
import { Cron, SchedulerRegistry } from '@nestjs/schedule';
import { add } from 'date-fns';
import { Member, NotifyParams } from '../member';
import { User } from '../user';
import { EventType, NotificationType, replaceConfigs } from '../common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Bitly } from '../providers';
import { InternalSchedulerService } from '.';
import { v4 } from 'uuid';

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
      const leader = await this.internalSchedulerService.getLeader(this.leaderType);
      if (!leader) {
        await this.internalSchedulerService.updateLeader({
          id: this.identifier,
          leaderType: this.leaderType,
        });
        this.amITheLeader = true;
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
          `${config.get('hosts.webApp')}/download/${appointmentId}`,
        );

        const metadata = {
          content: replaceConfigs({
            content: config.get('contents.newMemberNudge'),
            member,
            user,
          }).replace('@downloadLink@', `\n${url}`),
        };
        const params: NotifyParams = {
          memberId,
          userId: user.id,
          type: NotificationType.textSms,
          metadata,
        };

        this.eventEmitter.emit(EventType.notify, params);
        this.deleteTimeout({ id: memberId });
      }, milliseconds);
      this.schedulerRegistry.addTimeout(memberId, timeout);
    }
  }
}
