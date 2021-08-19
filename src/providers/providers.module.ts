import { Module } from '@nestjs/common';
import { ConfigsService, NotificationsService, SendBird, StorageService } from '.';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [HttpModule],
  providers: [SendBird, StorageService, ConfigsService, NotificationsService],
  exports: [SendBird, StorageService, ConfigsService, NotificationsService],
})
export class ProvidersModule {}
