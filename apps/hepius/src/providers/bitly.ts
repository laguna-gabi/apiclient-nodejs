import { HttpService } from '@nestjs/axios';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigsService, ExternalConfigs } from '.';
import { Environments } from '@argus/pandora';

@Injectable()
export class Bitly implements OnModuleInit {
  private readonly bitlyUrl = 'https://api-ssl.bitly.com/v4/shorten';
  private apiToken;
  private groupGuid;

  constructor(
    private readonly configsService: ConfigsService,
    private readonly httpService: HttpService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.apiToken = await this.configsService.getConfig(ExternalConfigs.bitly.apiToken);
    this.groupGuid = await this.configsService.getConfig(ExternalConfigs.bitly.groupGuid);
  }

  /**
   * Currently we're on a bit.ly free plan, which has 1000 links for a month.
   * We don't want to "waste" the credits on localhost games, so:
   * When running on environments:
   * 1. test - process.env.NODE_ENV = test - not generating a link.
   * 2. localhost - process.env.NODE_ENV = undefined - not generating a link.
   * 3. develop - process.env.NODE_ENV = develop - generating a link.
   * 4. production - process.env.NODE_ENV = production - generating a link.
   */
  async shortenLink(url): Promise<string> {
    if (!process.env.NODE_ENV || process.env.NODE_ENV === Environments.test) {
      return url;
    }
    const data = { long_url: url, group_guid: this.groupGuid };
    const config = {
      headers: { Authorization: `Bearer ${this.apiToken}`, 'Content-Type': 'application/json' },
    };
    const result = await this.httpService.post(this.bitlyUrl, data, config).toPromise();
    return result.data.link;
  }
}
