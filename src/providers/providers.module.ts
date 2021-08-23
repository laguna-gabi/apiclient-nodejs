import { Module } from '@nestjs/common';
import { ConfigsService, NotificationsService, SendBird, StorageService, SlackBot } from '.';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [HttpModule],
  providers: [SendBird, SlackBot, StorageService, ConfigsService, NotificationsService],
  exports: [SendBird, SlackBot, StorageService, ConfigsService, NotificationsService],
})
export class ProvidersModule {}
