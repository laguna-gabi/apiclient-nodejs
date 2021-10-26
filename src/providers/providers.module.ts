import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import {
  Bitly,
  CognitoService,
  ConfigsService,
  NotificationsService,
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
    NotificationsService,
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
  ],
  controllers: [WebhooksController],
})
export class ProvidersModule {}
