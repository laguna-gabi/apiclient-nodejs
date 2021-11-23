import { Injectable } from '@nestjs/common';
import { MongooseModuleOptions, MongooseOptionsFactory } from '@nestjs/mongoose';
import * as AWS from 'aws-sdk';
import * as config from 'config';
import { Environments } from '../../common';
import { BaseExternalConfigs } from '@lagunahealth/pandora';

export const ExternalConfigs = {
  ...BaseExternalConfigs,
  aws: {
    memberBucketName: 'aws.storage.memberBucketName',
    queueNameAudit: 'aws.sqs.queueNameAudit',
  },
  db: {
    connection: 'db.connection',
  },
  twilio: {
    accountSid: 'twilio.accountSid',
    appSid: 'twilio.appSid',
    authToken: 'twilio.authToken',
    apiKey: 'twilio.apiKey',
    apiSecret: 'twilio.apiSecret',
    webhookToken: 'twilio.webhookToken',
  },
  bitly: {
    apiToken: 'bitly.apiToken',
    groupGuid: 'bitly.groupGuid',
  },
};

@Injectable()
export class ConfigsService implements MongooseOptionsFactory {
  private data;

  async createMongooseOptions(): Promise<MongooseModuleOptions> {
    const uri =
      !process.env.NODE_ENV || process.env.NODE_ENV === Environments.test
        ? config.get('db.connection')
        : await this.getConfig(ExternalConfigs.db.connection);
    return { uri, useFindAndModify: false, useCreateIndex: true, useUnifiedTopology: true };
  }

  /**
   * Loading secrets once, on 1st usage
   * Modules are singleton in nestjs, so we're making sure that data will be initiated only once
   * in the whole app.
   */
  async getConfig(configs: string): Promise<string> {
    if (!this.data) {
      const secretsManager = new AWS.SecretsManager({ region: config.get('aws.region') });
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
