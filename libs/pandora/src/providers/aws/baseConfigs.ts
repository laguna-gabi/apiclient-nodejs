import { SecretsManager } from 'aws-sdk';
import { Environments } from '../../interfaces';
import { isOperationalEnv } from '../../utils';

export const BaseExternalConfigs = {
  aws: {
    queueNameNotifications: 'aws.sqs.queueNameNotifications',
    queueNameAudit: 'aws.sqs.queueNameAudit',
    queueNameChangeEvent: 'aws.sqs.queueNameChangeEvent',
    memberBucketName: 'aws.storage.memberBucketName',
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
    hepius: 'host.hepius',
    iris: 'host.iris',
    poseidon: 'host.poseidon',
  },
};

export class BaseConfigs {
  protected data;

  constructor(private awsRegion: string) {}

  async getEnvConfig({
    external,
    local,
    force = false,
  }: {
    external: string;
    local?: string;
    force?: boolean;
  }): Promise<string> {
    if (!force && !isOperationalEnv()) {
      return local;
    }

    return this.getConfig(external);
  }

  async getConfig(configs): Promise<string> {
    if (!this.data) {
      const secretsManager = new SecretsManager({ region: this.awsRegion });
      const result = await secretsManager
        .getSecretValue({ SecretId: this.getSecretId() })
        .promise();
      this.data = JSON.parse(result.SecretString);
    }

    return this.data[configs];
  }

  private getSecretId(): string {
    switch (process.env.NODE_ENV) {
      case Environments.production:
        return Environments.production;
      case Environments.staging:
        return Environments.staging;
      default:
        return Environments.develop;
    }
  }
}
