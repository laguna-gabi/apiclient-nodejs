import { BaseLogger } from '@lagunahealth/pandora';
import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ConfigsService, OneSignal, QueueService, Slack, Twilio } from '.';
import { CommonModule } from '../common';

@Module({
  imports: [CommonModule, HttpModule],
  providers: [ConfigsService, QueueService, Slack, BaseLogger, OneSignal, Twilio],
  exports: [ConfigsService],
})
export class ProvidersModule {}
