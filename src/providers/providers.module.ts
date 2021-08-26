import { Module } from '@nestjs/common';
import {
  ConfigsService,
  NotificationsService,
  SendBird,
  StorageService,
  SlackBot,
  TwilioService,
} from '.';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [HttpModule],
  providers: [
    SendBird,
    SlackBot,
    TwilioService,
    StorageService,
    ConfigsService,
    NotificationsService,
  ],
  exports: [
    SendBird,
    SlackBot,
    TwilioService,
    StorageService,
    ConfigsService,
    NotificationsService,
  ],
})
export class ProvidersModule {}
