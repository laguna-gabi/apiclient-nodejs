import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import {
  ConfigsService,
  Internationalization,
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
    Internationalization,
    NotificationsService,
  ],
  exports: [ConfigsService, Internationalization, NotificationsService],
})
export class ProvidersModule {}
