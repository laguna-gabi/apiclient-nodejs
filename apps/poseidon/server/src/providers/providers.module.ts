import { Module } from '@nestjs/common';
import { RevAI, Slack, WebhooksController } from '.';
import { CommonModule } from '../common';
import { ConfigsService, QueueService, StorageService } from './aws';

@Module({
  imports: [CommonModule],
  providers: [ConfigsService, Slack, QueueService, StorageService, RevAI],
  exports: [ConfigsService, RevAI, StorageService],
  controllers: [WebhooksController],
})
export class ProvidersModule {}
