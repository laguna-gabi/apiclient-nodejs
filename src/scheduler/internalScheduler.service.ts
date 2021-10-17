import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as config from 'config';
import { Model } from 'mongoose';
import { InternalSchedulerDocument, LeaderType, Scheduler } from '.';

@Injectable()
export class InternalSchedulerService {
  constructor(
    @InjectModel(Scheduler.name)
    private readonly internalSchedulerModel: Model<InternalSchedulerDocument>,
  ) {}

  async getLeader(leaderType: LeaderType): Promise<Scheduler> {
    const gapDate = new Date();
    gapDate.setMinutes(gapDate.getMinutes() - config.get('scheduler.cronJobIntervalInMin'));
    /**
     * a cron job happens every 1 minute, so multiple services will run at the same
     * time : 10:01:00, 10:02:00 etc.
     * we need to have a gap for get leader of 1 minute and 10 seconds, in order to avoid delays
     */
    gapDate.setSeconds(gapDate.getSeconds() - 10);

    return this.internalSchedulerModel.findOne({ leaderType, updatedAt: { $gte: gapDate } });
  }

  async updateLeader(scheduler: Scheduler): Promise<Scheduler> {
    return this.internalSchedulerModel.findOneAndUpdate(
      { leaderType: scheduler.leaderType },
      { $set: scheduler },
      { upsert: true, new: true },
    );
  }

  async resetLeader(leaderType: LeaderType) {
    await this.internalSchedulerModel.deleteOne({ leaderType });
  }
}
