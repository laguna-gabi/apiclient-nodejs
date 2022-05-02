import { BaseConfigs, BaseExternalConfigs } from '@argus/pandora';
import { Injectable } from '@nestjs/common';
import { MongooseModuleOptions } from '@nestjs/mongoose';
import { aws, db } from 'config';

export const ExternalConfigs = {
  ...BaseExternalConfigs,
  db: {
    connection: { iris: 'db.connection.iris' },
  },
  aws: {
    ...BaseExternalConfigs.aws,
    queueNameNotificationsDLQ: `aws.sqs.queueNameNotificationsDLQ`,
  },
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
    const uri = `${await this.getConfig(ExternalConfigs.db.connection.iris)}/${
      db.name
    }?retryWrites=true&w=majority`;
    return { uri };
  }
}
