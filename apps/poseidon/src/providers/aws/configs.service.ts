import { BaseConfigs, BaseExternalConfigs, Environments, ServiceName } from '@argus/pandora';
import { Injectable } from '@nestjs/common';
import { MongooseModuleOptions, MongooseOptionsFactory } from '@nestjs/mongoose';
import { aws, db } from 'config';

export const ExternalConfigs = {
  ...BaseExternalConfigs,
  aws: {
    ...BaseExternalConfigs.aws,
    queueNameTranscript: 'aws.sqs.queueNameTranscript',
  },
  db: {
    connection: { poseidon: 'db.connection.poseidon' },
  },
  revAI: {
    accessToken: 'revAI.accessToken',
  },
};

@Injectable()
export class ConfigsService extends BaseConfigs implements MongooseOptionsFactory {
  constructor() {
    super(aws.region);
  }

  async createMongooseOptions(): Promise<MongooseModuleOptions> {
    const uri =
      !process.env.NODE_ENV || process.env.NODE_ENV === Environments.test
        ? `${db.connection}/${ServiceName.poseidon}`
        : await this.getConfig(ExternalConfigs.db.connection.poseidon);
    return { uri };
  }
}
