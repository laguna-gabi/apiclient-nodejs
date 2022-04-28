import { Module } from '@nestjs/common';
import { RevAI } from '.';
import { CommonModule } from '../common';
import { ConfigsService, QueueService, StorageService } from './aws';

@Module({
  imports: [CommonModule],
  providers: [ConfigsService, QueueService, StorageService, RevAI],
  exports: [ConfigsService],
})
export class ProvidersModule {}
