import { Injectable, OnModuleInit } from '@nestjs/common';
import { User } from '@argus/hepiusClient';
import { ConfigsService, ExternalConfigs } from '.';
import { v4 } from 'uuid';
import { sign } from 'jsonwebtoken';

@Injectable()
export class ZenDesk implements OnModuleInit {
  private apiToken;

  constructor(private readonly configsService: ConfigsService) {}

  async onModuleInit(): Promise<void> {
    this.apiToken = await this.configsService.getConfig(ExternalConfigs.zendesk.token);
  }

  getAuthToken({
    firstName,
    lastName,
    email,
  }: Pick<User, 'email' | 'firstName' | 'lastName'>): string {
    const payload = {
      name: `${firstName} ${lastName}`,
      iat: new Date().getTime() / 1000,
      jti: v4(),
      email,
    };

    return sign(payload, this.apiToken);
  }
}
