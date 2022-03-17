import { BaseExternalConfigs, Environments } from '@argus/pandora';
import { Injectable } from '@nestjs/common';
import { MongooseModuleOptions, MongooseOptionsFactory } from '@nestjs/mongoose';
import * as AWS from 'aws-sdk';
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
export class ConfigsService implements MongooseOptionsFactory {
  private data;

  async createMongooseOptions(): Promise<MongooseModuleOptions> {
    const uri = `${await this.getConfig(ExternalConfigs.db.connection)}/${db.name}`;
    return { uri, useUnifiedTopology: true };
  }

  /**
   * Loading secrets once, on 1st usage
   * Modules are singleton in nestjs, so we're making sure that data will be initiated only once
   * in the whole app.
   */
  async getConfig(configs: string): Promise<string> {
    if (!this.data) {
      const secretsManager = new AWS.SecretsManager({ region: aws.region });
      const result = await secretsManager
        .getSecretValue({
          SecretId:
            process.env.NODE_ENV === Environments.production
              ? Environments.production
              : Environments.development,
        })
        .promise();
      this.data = JSON.parse(result.SecretString);
    }

    return this.data[configs];
  }
}
