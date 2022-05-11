import { Environments } from '@argus/pandora';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { RevAiApiClient } from 'revai-node-sdk';
import { ConfigsService, ExternalConfigs } from '.';

@Injectable()
export class RevAI implements OnModuleInit {
  private accessToken: string;
  private client: RevAiApiClient;

  constructor(private readonly configsService: ConfigsService) {}

  async onModuleInit() {
    this.accessToken = await this.configsService.getConfig(ExternalConfigs.revAI.accessToken);
    this.client = new RevAiApiClient(this.accessToken);
  }

  async createTranscript(url: string): Promise<string | undefined> {
    if (
      process.env.NODE_ENV === Environments.production ||
      process.env.NODE_ENV === Environments.develop
    ) {
      const { id } = await this.client.submitJobUrl(url, {
        callback_url: '', // will be added once we have url for poseidon
        language: 'en',
      });
      return id;
    }
  }
}
