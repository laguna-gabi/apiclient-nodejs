import { Module } from '@nestjs/common';
import {
  ConfigsService,
  NotificationsService,
  SendBird,
  StorageService,
  SlackBot,
  TwilioService,
  Bitly,
} from '.';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [HttpModule],
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
})
export class ProvidersModule {}
