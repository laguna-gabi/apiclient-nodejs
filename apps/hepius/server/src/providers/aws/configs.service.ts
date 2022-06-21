import { BaseConfigs, BaseExternalConfigs, Environments, ServiceName } from '@argus/pandora';
import { Injectable } from '@nestjs/common';
import { MongooseModuleOptions, MongooseOptionsFactory } from '@nestjs/mongoose';
import { aws, db } from 'config';

export const ExternalConfigs = {
  ...BaseExternalConfigs,
  db: {
    connection: { hepius: 'db.connection.hepius' },
  },
  aws: {
    ...BaseExternalConfigs.aws,
    queueNameImage: 'aws.sqs.queueNameImage',
  },
  analytics: {
    dbUsername: 'analytics.db.username',
    dbPassword: 'analytics.db.password',
  },
  twilio: {
    accountSid: 'twilio.accountSid',
    appSid: 'twilio.appSid',
    authToken: 'twilio.authToken',
    apiKey: 'twilio.apiKey',
    apiSecret: 'twilio.apiSecret',
    webhookToken: 'twilio.webhookToken',
  },
  split: {
    apiKey: 'split.apiKey',
  },
  zendesk: {
    token: 'zendesk.token',
  },
};

@Injectable()
export class ConfigsService extends BaseConfigs implements MongooseOptionsFactory {
  constructor() {
    super(aws.region);
  }

  async createMongooseOptions(): Promise<MongooseModuleOptions> {
    const uri =
      !process.env.NODE_ENV ||
      process.env.NODE_ENV === Environments.test ||
      process.env.NODE_ENV === Environments.localhost
        ? `${db.connection}/${ServiceName.hepius}`
        : await this.getConfig(ExternalConfigs.db.connection.hepius);
    return { uri };
  }
}
