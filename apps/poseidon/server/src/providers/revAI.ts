import { Environments, webhooks } from '@argus/pandora';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { hosts } from 'config';
import { RevAiApiClient, RevAiApiTranscript } from 'revai-node-sdk';
import { ConfigsService, ExternalConfigs } from '.';
import { LoggerService, revai } from '../common';

@Injectable()
export class RevAI implements OnModuleInit {
  private accessToken: string;
  private client: RevAiApiClient;

  constructor(
    private readonly configsService: ConfigsService,
    private readonly logger: LoggerService,
  ) {}

  async onModuleInit() {
    this.accessToken = await this.configsService.getConfig(ExternalConfigs.revAI.accessToken);
    this.client = new RevAiApiClient(this.accessToken);
  }

  async createTranscript(url: string): Promise<string> {
    if (process.env.NODE_ENV === Environments.production) {
      const { id } = await this.client.submitJob({
        source_config: { url },
        notification_config: { url: `${hosts.api}/${webhooks}/${revai}` },
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
}
