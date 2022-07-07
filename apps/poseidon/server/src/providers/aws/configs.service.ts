import { BaseConfigs, BaseExternalConfigs, ServiceName, isOperationalEnv } from '@argus/pandora';
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
    webhookToken: 'revAI.webhookToken',
  },
};

@Injectable()
export class ConfigsService extends BaseConfigs implements MongooseOptionsFactory {
  constructor() {
    super(aws.region);
  }

  async createMongooseOptions(): Promise<MongooseModuleOptions> {
    const uri = isOperationalEnv()
      ? await this.getConfig(ExternalConfigs.db.connection.poseidon)
      : `${db.connection}/${ServiceName.poseidon}`;
    return { uri };
  }
}
