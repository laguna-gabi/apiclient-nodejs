import { BaseLogger } from '@lagunahealth/pandora';
import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ConfigsService, NotificationsService, OneSignal, SendBird, Slack, Twilio } from '.';
import { CommonModule } from '../common';

@Module({
  imports: [CommonModule, HttpModule],
  providers: [ConfigsService, SendBird, Slack, BaseLogger, OneSignal, Twilio, NotificationsService],
  exports: [ConfigsService, NotificationsService],
})
export class ProvidersModule {}
