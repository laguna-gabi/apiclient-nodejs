import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ChangeStream, ChangeStreamDocument } from 'mongodb';
import { Model } from 'mongoose';
import { Trigger, TriggerDocument } from '.';

@Injectable()
export class TriggersService implements OnModuleInit, OnModuleDestroy {
  private watchObject: ChangeStream;
  private triggeredCallback: (triggeredId: string) => Promise<void>;

  constructor(@InjectModel(Trigger.name) private readonly triggerModel: Model<TriggerDocument>) {}

  async onModuleInit() {
    this.watchObject = this.triggerModel.watch([]);

    //this.watchObject.on('delete', ...) -> this doesn't work, so don't change it
    this.watchObject.on('change', async (event: ChangeStreamDocument) => {
      if (event.operationType === 'delete') {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        const objectId = event.documentKey._id.toString();
        await this.triggeredCallback(objectId);
      }
    });
  }

  set onTriggeredCallback(value: (triggeredId: string) => Promise<void>) {
    this.triggeredCallback = value;
  }

  async onModuleDestroy() {
    await this.watchObject?.close();
  }

  async update(trigger: Trigger) {
    return this.triggerModel.findOneAndUpdate(
      { dispatchId: trigger.dispatchId },
      { $set: trigger },
      { upsert: true, new: true },
    );
  }

  async get(dispatchId: string): Promise<Trigger | null> {
    return this.triggerModel.findOne({ dispatchId });
  }

  async delete(dispatchId: string) {
    await this.triggerModel.deleteOne({ dispatchId });
  }
}
