import { Environments, webhooks } from '@argus/pandora';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { hosts } from 'config';
import { RevAiApiClient, RevAiApiTranscript } from 'revai-node-sdk';
import { ConfigsService, ExternalConfigs } from '.';
import { revai } from '../common';

@Injectable()
export class RevAI implements OnModuleInit {
  private accessToken: string;
  private webhookToken: string;
  private client: RevAiApiClient;

  constructor(private readonly configsService: ConfigsService) {}

  async onModuleInit() {
    this.accessToken = await this.configsService.getConfig(ExternalConfigs.revAI.accessToken);
    this.webhookToken = await this.configsService.getConfig(ExternalConfigs.revAI.webhookToken);
    this.client = new RevAiApiClient(this.accessToken);
  }

  async createTranscript(url: string): Promise<string> {
    if (process.env.NODE_ENV === Environments.production) {
      const { id } = await this.client.submitJob({
        source_config: { url },
        notification_config: {
          url: `${hosts.api}/${webhooks}/${revai}`,
          auth_headers: { ['authorization']: this.webhookToken },
        },
      });
      return id;
    }
  }

  async getTranscriptObject(transcriptionId: string): Promise<RevAiApiTranscript> {
    return this.client.getTranscriptObject(transcriptionId);
  }

  async getTranscriptText(transcriptionId: string): Promise<string> {
    return this.client.getTranscriptText(transcriptionId);
  }

  validateWebhook(token: string) {
    return token === this.webhookToken;
  }
}
