import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import {
  Bitly,
  CognitoService,
  ConfigsService,
  FeatureFlagService,
  NotificationsService,
  OneSignal,
  QueueService,
  SendBird,
  SlackBot,
  StorageService,
  TwilioService,
  WebhooksController,
} from '.';
import { CommonModule } from '../common';

@Module({
  imports: [HttpModule, CommonModule],
  providers: [
    Bitly,
    SendBird,
    SlackBot,
    TwilioService,
    StorageService,
    CognitoService,
    ConfigsService,
    QueueService,
    OneSignal,
    NotificationsService,
    FeatureFlagService,
  ],
  exports: [
    Bitly,
    SendBird,
    SlackBot,
    TwilioService,
    StorageService,
    CognitoService,
    ConfigsService,
    NotificationsService,
    FeatureFlagService,
  ],
  controllers: [WebhooksController],
})
export class ProvidersModule {}
