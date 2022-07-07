import { Injectable, OnModuleInit } from '@nestjs/common';
import { SplitFactory } from '@splitsoftware/splitio';
import { IClient, ISDK, Treatment as SplitioTreatment } from '@splitsoftware/splitio/types/splitio';
import { split } from 'config';
import { v4 } from 'uuid';
import { ConfigsService, ExternalConfigs } from '.';

enum Treatment {
  on = 'on',
  off = 'off',
}

@Injectable()
export class FeatureFlagService implements OnModuleInit {
  private client: IClient;

  constructor(private readonly configsService: ConfigsService) {}

  async onModuleInit() {
    const authorizationKey = await this.getApiKey();
    const factory: ISDK = SplitFactory({ core: { authorizationKey } });
    this.client = factory.client();
  }

  private async getApiKey(): Promise<string> {
    return this.configsService.getEnvConfig({
      external: ExternalConfigs.split.apiKey,
      local: split.apiKey,
    });
  }

  async onModuleDestroy() {
    this.client?.destroy?.();
  }

  async isControlGroup(orgId: string): Promise<boolean> {
    // the id has to be random in order to avoid getting the same treatment everytime
    const treatment: SplitioTreatment = await this.client.getTreatment(v4(), 'control_group', {
      orgId,
    });
    return treatment == Treatment.on;
  }
}
