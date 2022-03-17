import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ClientSettings, ClientSettingsDocument } from '.';
import { filterNonNullFields } from '../common';

@Injectable()
export class SettingsService {
  constructor(
    @InjectModel(ClientSettings.name)
    private readonly clientSettingsModel: Model<ClientSettingsDocument>,
  ) {}

  async update(settings: ClientSettings): Promise<ClientSettings> {
    return this.clientSettingsModel.findOneAndUpdate(
      { id: settings.id },
      { $set: filterNonNullFields(settings) },
      { upsert: true, new: true },
    );
  }

  /**
   * @param id dispatchId (and not _id)
   */
  async get(id: string): Promise<ClientSettings | null> {
    return this.clientSettingsModel.findOne({ id });
  }

  /**
   * @param id dispatchId (and not _id)
   */
  async delete(id: string): Promise<void> {
    const result = await this.clientSettingsModel.find({ id });
    if (result?.length >= 1) {
      await result[0].delete();
    }
  }
}
