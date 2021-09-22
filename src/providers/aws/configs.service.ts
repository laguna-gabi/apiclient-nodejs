import { Injectable } from '@nestjs/common';
import * as AWS from 'aws-sdk';
import * as config from 'config';
import { MongooseModuleOptions, MongooseOptionsFactory } from '@nestjs/mongoose';

export const ExternalConfigs = {
  aws: {
    memberBucketName: 'aws.storage.memberBucketName',
  },
  db: {
    connection: 'db.connection',
  },
  oneSignal: {
    defaultApiId: 'onesignal.default.apiId',
    defaultApiKey: 'onesignal.default.apiKey',
    voipApiId: 'onesignal.voip.apiId',
    voipApiKey: 'onesignal.voip.apiKey',
  },
  sendbird: {
    apiId: 'sendbird.apiId',
    apiToken: 'sendbird.apiToken',
  },
  slack: {
    url: 'slack.url',
  },
  twilio: {
    accountSid: 'twilio.accountSid',
    appSid: 'twilio.appSid',
    authToken: 'twilio.authToken',
    apiKey: 'twilio.apiKey',
    apiSecret: 'twilio.apiSecret',
  },
  bitly: {
    apiToken: 'bitly.apiToken',
    groupGuid: 'bitly.groupGuid',
  },
};

enum environments {
  production = 'production',
  development = 'development',
}

@Injectable()
export class ConfigsService implements MongooseOptionsFactory {
  private data;

  async createMongooseOptions(): Promise<MongooseModuleOptions> {
    const uri =
      Object.keys(environments).indexOf(process.env.NODE_ENV) >= 0
        ? await this.getConfig(ExternalConfigs.db.connection)
        : config.get('db.connection');
    return { uri, useFindAndModify: false, useCreateIndex: true, useUnifiedTopology: true };
  }

  /**
   * Loading secrets once, on 1st usage
   * Modules are singleton in nestjs, so we're making sure that data will be initiated only once
   * in the whole app.
   */
  async getConfig(configs: string): Promise<string> {
    if (!this.data) {
      const secretsManager = new AWS.SecretsManager({ region: config.get('providers.aws.region') });
      const result = await secretsManager
        .getSecretValue({
          SecretId:
            process.env.NODE_ENV === environments.production
              ? environments.production
              : environments.development,
        })
        .promise();
      this.data = JSON.parse(result.SecretString);
    }

    return this.data[configs];
  }
}
