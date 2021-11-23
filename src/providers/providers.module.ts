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
    FeatureFlagService,
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
  ],
  exports: [
    FeatureFlagService,
    Bitly,
    SendBird,
    SlackBot,
    TwilioService,
    StorageService,
    CognitoService,
    ConfigsService,
    NotificationsService,
  ],
  controllers: [WebhooksController],
})
export class ProvidersModule {}
