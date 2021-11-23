import { Injectable, OnModuleInit } from '@nestjs/common';
import { SplitFactory } from '@splitsoftware/splitio';
import { ConfigsService, ExternalConfigs } from './aws';

@Injectable()
export class FeatureFlagService implements OnModuleInit {
  private client: SplitIO.IClient;

  constructor(private readonly configsService: ConfigsService) {}

  async onModuleInit() {
    const apiKey = await this.configsService.getConfig(ExternalConfigs.split.apiKey);
    const factory: SplitIO.ISDK = SplitFactory({
      core: {
        authorizationKey: apiKey,
      },
    });
    this.client = factory.client();
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.destroy();
    }
  }
}
