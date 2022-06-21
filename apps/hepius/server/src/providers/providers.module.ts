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
  ZenDesk,
} from '.';
import { CommonModule } from '../common';
import { Internationalization } from './internationalization';

const exportedProviders = [
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
  ZenDesk,
];

@Module({
  imports: [HttpModule, CommonModule],
  providers: [...exportedProviders, QueueService],
  exports: exportedProviders,
  controllers: [WebhooksController],
})
export class ProvidersModule {}
