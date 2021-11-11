import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Trigger, TriggerDocument } from '.';

@Injectable()
export class TriggersService {
  constructor(@InjectModel(Trigger.name) private readonly triggerModel: Model<TriggerDocument>) {
    console.log('before ctor of triggerservice');
    triggerModel.watch([]).on('change', (event) => {
      console.log({ event });
    });
    console.log('after ctor of triggerservice');
  }

  async doSomething() {
    await this.triggerModel.create({ id: 'asdfasdf' });
  }
}
