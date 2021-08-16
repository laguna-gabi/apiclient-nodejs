import { Module } from '@nestjs/common';
import { SendBird, StorageService, ConfigsService } from '.';

@Module({
  providers: [SendBird, StorageService, ConfigsService],
  exports: [SendBird, StorageService, ConfigsService],
})
export class ProvidersModule {}
