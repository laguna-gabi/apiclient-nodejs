import { BaseConfigs, BaseExternalConfigs, Environments } from '@argus/pandora';
import { Injectable } from '@nestjs/common';
import { MongooseModuleOptions } from '@nestjs/mongoose';
import { aws, db } from 'config';

export const ExternalConfigs = {
  ...BaseExternalConfigs,
  aws: {
    ...BaseExternalConfigs.aws,
    memberBucketName: 'aws.storage.memberBucketName',
    queueNameImage: 'aws.sqs.queueNameImage',
  },
  db: {
    connection: 'db.connection',
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
};

@Injectable()
export class ConfigsService extends BaseConfigs {
  constructor() {
    super(aws.region);
  }

  async createMongooseOptions(): Promise<MongooseModuleOptions> {
    const uri =
      !process.env.NODE_ENV || process.env.NODE_ENV === Environments.test
        ? db.connection
        : await this.getConfig(ExternalConfigs.db.connection);
    return { uri };
  }
}
