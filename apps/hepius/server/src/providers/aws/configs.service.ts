import { BaseConfigs, BaseExternalConfigs, ServiceName } from '@argus/pandora';
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
  voximplant: {
    token: 'voximplant.token',
    applicationName: 'voximplant.applicationName',
    applicationId: 'voximplant.applicationId',
  },
};

@Injectable()
export class ConfigsService extends BaseConfigs implements MongooseOptionsFactory {
  constructor() {
    super(aws.region);
  }

  async createMongooseOptions(): Promise<MongooseModuleOptions> {
    const uri = await this.getEnvConfig({
      external: ExternalConfigs.db.connection.hepius,
      local: `${db.connection}/${ServiceName.hepius}`,
    });
    return { uri };
  }
}
