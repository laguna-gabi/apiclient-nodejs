import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ClientSettings, ClientSettingsDocument } from '.';

@Injectable()
export class SettingsService {
  constructor(
    @InjectModel(ClientSettings.name)
    private readonly clientSettingsModel: Model<ClientSettingsDocument>,
  ) {}

  async update(settings: ClientSettings): Promise<ClientSettings> {
    const setParams = Object.keys(settings)
      .filter((k) => settings[k] !== null)
      .reduce((a, k) => ({ ...a, [k]: settings[k] }), {});

    return this.clientSettingsModel.findOneAndUpdate(
      { id: settings.id },
      { $set: setParams },
      { upsert: true, new: true },
    );
  }

  async get(id: string): Promise<ClientSettings | null> {
    return this.clientSettingsModel.findOne({ id });
  }
}
