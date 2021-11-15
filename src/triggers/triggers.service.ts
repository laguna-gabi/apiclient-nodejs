import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ChangeStream } from 'mongodb';
import { Model } from 'mongoose';
import { Trigger, TriggerDocument } from '.';

@Injectable()
export class TriggersService implements OnModuleInit, OnModuleDestroy {
  private watchObject: ChangeStream;

  constructor(@InjectModel(Trigger.name) private readonly triggerModel: Model<TriggerDocument>) {}

  async onModuleInit() {
    this.watchObject = this.triggerModel.watch([]);
    this.watchObject.on('delete', async (event) => {
      console.log(event);
    });
  }

  async onModuleDestroy() {
    await this.watchObject.close();
  }

  async update(trigger: Trigger): Promise<Trigger> {
    return this.triggerModel.findOneAndUpdate(
      { dispatchId: trigger.dispatchId },
      { $set: trigger },
      { upsert: true, new: true },
    );
  }

  async get(dispatchId: string): Promise<Trigger | null> {
    return this.triggerModel.findOne({ dispatchId });
  }
}
