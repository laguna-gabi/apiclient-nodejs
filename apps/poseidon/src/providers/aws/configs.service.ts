import {
  BaseConfigs,
  BaseExternalConfigs,
  Environments,
  ServiceName,
  mongoConnectionStringSettings,
} from '@argus/pandora';
import { Injectable } from '@nestjs/common';
import { MongooseModuleOptions } from '@nestjs/mongoose';
import { aws, db } from 'config';

export const ExternalConfigs = {
  ...BaseExternalConfigs,
};

@Injectable()
export class ConfigsService extends BaseConfigs {
  constructor() {
    super(aws.region);
  }

  async createMongooseOptions(): Promise<MongooseModuleOptions> {
    const uri =
      !process.env.NODE_ENV || process.env.NODE_ENV === Environments.test
        ? `${db.connection}/${ServiceName.poseidon}`
        : `${await this.getConfig(ExternalConfigs.db.connection)}/${
            ServiceName.poseidon
          }${mongoConnectionStringSettings}`;
    return { uri };
  }
}
