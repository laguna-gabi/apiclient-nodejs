import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import {
  Bitly,
  CloudMapService,
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
import { Internationalization } from './internationalization';

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
    CloudMapService,
    Internationalization,
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
    CloudMapService,
    Internationalization,
  ],
  controllers: [WebhooksController],
})
export class ProvidersModule {}
