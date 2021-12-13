import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ChangeStream, ChangeStreamDocument } from 'mongodb';
import { Model } from 'mongoose';
import { Trigger, TriggerDocument } from '.';

@Injectable()
export class TriggersService implements OnModuleInit, OnModuleDestroy {
  private watchObject: ChangeStream;
  private triggeredCallback: (triggeredId: string) => Promise<void>;
  /**
   * When DeleteDispatch is called, we don't want to be using the watch on deleted events,
   * as they are not supposed to occur. We'll cache those on run time as we're assuming the
   * trigger for deleting events happens in 1 minute max.
   */
  private ignoreDeletes = new Set();

  constructor(@InjectModel(Trigger.name) private readonly triggerModel: Model<TriggerDocument>) {}

  async onModuleInit() {
    this.watchObject = this.triggerModel.watch([]);

    //this.watchObject.on('delete', ...) -> this doesn't work, so don't change it
    this.watchObject.on('change', async (event: ChangeStreamDocument) => {
      if (event.operationType === 'delete') {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        const objectId = event.documentKey._id.toString();
        if (this.ignoreDeletes.has(objectId)) {
          this.ignoreDeletes.delete(objectId);
        } else {
          await this.triggeredCallback(objectId);
        }
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
    const result = await this.triggerModel.findOne({ dispatchId });
    if (result) {
      this.ignoreDeletes.add(result._id.toString());
      await this.triggerModel.deleteOne({ dispatchId });
    }
  }
}
