import { Injectable } from '@nestjs/common';
import * as AWS from 'aws-sdk';
import * as config from 'config';
import { MongooseModuleOptions, MongooseOptionsFactory } from '@nestjs/mongoose';

export enum ExternalConfigs {
  db = 'db.connection',
  sendbirdApiId = 'sendbird.apiId',
  sendbirdApiToken = 'sendbird.apiToken',
  awsStorageMember = 'aws.storage.memberBucketName',
  slackUrl = 'slack.url',
  oneSignalDefaultApiId = 'onesignal.default.apiId',
  oneSignalDefaultApiKey = 'onesignal.default.apiKey',
  oneSignalVoipApiId = 'onesignal.voip.apiId',
  oneSignalVoipApiKey = 'onesignal.voip.apiKey',
}

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
        ? await this.getConfig(ExternalConfigs.db)
        : config.get('db.connection');
    return { uri, useFindAndModify: false, useCreateIndex: true, useUnifiedTopology: true };
  }

  /**
   * Loading secrets once, on 1st usage
   * Modules are singleton in nestjs, so we're making sure that data will be initiated only once
   * in the whole app.
   */
  async getConfig(configs: ExternalConfigs): Promise<string> {
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
