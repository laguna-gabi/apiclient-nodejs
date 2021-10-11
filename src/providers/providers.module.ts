import { Module } from '@nestjs/common';
import {
  Bitly,
  ConfigsService,
  NotificationsService,
  SendBird,
  SlackBot,
  StorageService,
  TwilioService,
  WebhooksController,
} from '.';
import { HttpModule } from '@nestjs/axios';
import { CommonModule } from '../common';

@Module({
  imports: [HttpModule, CommonModule],
  providers: [
    Bitly,
    SendBird,
    SlackBot,
    TwilioService,
    StorageService,
    ConfigsService,
    NotificationsService,
  ],
  exports: [
    Bitly,
    SendBird,
    SlackBot,
    TwilioService,
    StorageService,
    ConfigsService,
    NotificationsService,
  ],
  controllers: [WebhooksController],
})
export class ProvidersModule {}
