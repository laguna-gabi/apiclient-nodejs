import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import {
  Bitly,
  ConfigsService,
  InternationalizationService,
  NotificationsService,
  OneSignal,
  SendBird,
  Slack,
  Twilio,
} from '.';
import { CommonModule } from '../common';

@Module({
  imports: [CommonModule, HttpModule],
  providers: [
    ConfigsService,
    SendBird,
    Slack,
    OneSignal,
    Twilio,
    InternationalizationService,
    NotificationsService,
    Bitly,
  ],
  exports: [ConfigsService, InternationalizationService, NotificationsService],
})
export class ProvidersModule {}
