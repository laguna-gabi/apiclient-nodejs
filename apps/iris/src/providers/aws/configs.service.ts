import { BaseConfigs, BaseExternalConfigs } from '@argus/pandora';
import { Injectable } from '@nestjs/common';
import { MongooseModuleOptions } from '@nestjs/mongoose';
import { aws, db } from 'config';

export const ExternalConfigs = {
  ...BaseExternalConfigs,
  aws: {
    ...BaseExternalConfigs.aws,
    queueNameNotificationsDLQ: `aws.sqs.queueNameNotificationsDLQ`,
  },
  db: { connection: 'db.connection.iris' },
  twilio: {
    accountSid: 'twilio.accountSid',
    authToken: 'twilio.authToken',
  },
};

@Injectable()
export class ConfigsService extends BaseConfigs {
  constructor() {
    super(aws.region);
  }

  async createMongooseOptions(): Promise<MongooseModuleOptions> {
    const uri = `${await this.getConfig(ExternalConfigs.db.connection)}/${db.name}`;
    return { uri };
  }
}
