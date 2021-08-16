import { Module } from '@nestjs/common';
import { SendBird, StorageService } from '.';

@Module({
  providers: [SendBird, StorageService],
  exports: [SendBird, StorageService],
})
export class ProvidersModule {}
