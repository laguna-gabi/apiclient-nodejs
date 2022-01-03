import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import {
  Bitly,
  CognitoService,
  ConfigsService,
  FeatureFlagService,
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
    OneSignal,
    TwilioService,
    StorageService,
    CognitoService,
    ConfigsService,
    QueueService,
    FeatureFlagService,
  ],
  exports: [
    Bitly,
    SendBird,
    SlackBot,
    OneSignal,
    TwilioService,
    StorageService,
    CognitoService,
    ConfigsService,
    FeatureFlagService,
  ],
  controllers: [WebhooksController],
})
export class ProvidersModule {}
