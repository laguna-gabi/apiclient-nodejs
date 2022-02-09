import { Environments } from '@lagunahealth/pandora';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { SplitFactory } from '@splitsoftware/splitio';
import SplitIO from '@splitsoftware/splitio/types/splitio';
import { ConfigsService, ExternalConfigs } from '.';
import { v4 } from 'uuid';
import * as config from 'config';

enum Treatment {
  on = 'on',
  off = 'off',
}

@Injectable()
export class FeatureFlagService implements OnModuleInit {
  private client: SplitIO.IClient;

  constructor(private readonly configsService: ConfigsService) {}

  async onModuleInit() {
    const authorizationKey = await this.getApiKey();
    const factory: SplitIO.ISDK = SplitFactory({ core: { authorizationKey } });
    this.client = factory.client();
  }

  private async getApiKey(): Promise<string> {
    return !process.env.NODE_ENV || process.env.NODE_ENV === Environments.test
      ? config.get('split.apiKey')
      : await this.configsService.getConfig(ExternalConfigs.split.apiKey);
  }

  async onModuleDestroy() {
    this.client?.destroy?.();
  }

  async isControlGroup(orgId: string): Promise<boolean> {
    // the id has to be random in order to avoid getting the same treatment everytime
    const treatment: SplitIO.Treatment = await this.client.getTreatment(v4(), 'control_group', {
      orgId,
    });
    return treatment == Treatment.on;
  }
}
