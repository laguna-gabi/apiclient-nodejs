import { Environments } from '@argus/pandora';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { RevAiApiClient, RevAiApiTranscript } from 'revai-node-sdk';
import { ConfigsService, ExternalConfigs } from '.';
import { LoggerService } from '../common';

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
    if (
      process.env.NODE_ENV === Environments.production ||
      process.env.NODE_ENV === Environments.develop
    ) {
      try {
        const { id } = await this.client.submitJobUrl(url, {
          // callback_url: '', // will be added once we have url for poseidon
          language: 'en',
        });
        return id;
      } catch (ex) {
        this.logger.error({}, RevAI.name, this.createTranscript.name, ex);
      }
    }
  }

  async getTranscriptObject(transcriptionId: string): Promise<RevAiApiTranscript> {
    return this.client.getTranscriptObject(transcriptionId);
  }

  async getTranscriptText(transcriptionId: string): Promise<string> {
    return this.client.getTranscriptText(transcriptionId);
  }
}
