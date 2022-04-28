import { Module } from '@nestjs/common';
import { RevAI } from '.';
import { CommonModule } from '../common';
import { ConfigsService, QueueService } from './aws';

@Module({
  imports: [CommonModule],
  providers: [ConfigsService, QueueService, RevAI],
  exports: [ConfigsService],
})
export class ProvidersModule {}
