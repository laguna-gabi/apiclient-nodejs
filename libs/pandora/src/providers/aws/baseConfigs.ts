import { MongooseModuleOptions, MongooseOptionsFactory } from '@nestjs/mongoose';
import { SecretsManager } from 'aws-sdk';
import { Environments } from '../../interfaces';

export const BaseExternalConfigs = {
  db: {
    connection: 'db.connection',
  },
  aws: {
    queueNameNotifications: 'aws.sqs.queueNameNotifications',
    queueNameAudit: 'aws.sqs.queueNameAudit',
    queueNameTranscript: 'aws.sqs.queueNameTranscript',
  },
  oneSignal: {
    defaultApiId: 'onesignal.default.apiId',
    defaultApiKey: 'onesignal.default.apiKey',
    voipApiId: 'onesignal.voip.apiId',
    voipApiKey: 'onesignal.voip.apiKey',
  },
  slack: {
    url: 'slack.url',
  },
  sendbird: {
    apiId: 'sendbird.apiId',
    apiToken: 'sendbird.apiToken',
    masterApiToken: 'sendbird.masterApiToken',
  },
  bitly: {
    apiToken: 'bitly.apiToken',
    groupGuid: 'bitly.groupGuid',
  },
  host: {
    iris: 'host.iris',
    hepius: 'host.hepius',
  },
};

export const mongoConnectionStringSettings = '?retryWrites=true&w=majority';

export abstract class BaseConfigs implements MongooseOptionsFactory {
  protected data;

  constructor(private awsRegion: string) {}

  abstract createMongooseOptions(): Promise<MongooseModuleOptions>;

  async getConfig(configs: string): Promise<string> {
    if (!this.data) {
      const secretsManager = new SecretsManager({ region: this.awsRegion });
      const result = await secretsManager
        .getSecretValue({
          SecretId:
            process.env.NODE_ENV === Environments.production
              ? Environments.production
              : Environments.develop,
        })
        .promise();
      this.data = JSON.parse(result.SecretString);
    }

    return this.data[configs];
  }
}
