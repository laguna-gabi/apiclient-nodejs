import { Module } from '@nestjs/common';
import { CommonModule } from '../common';
import { ConfigsService, QueueService } from './aws';

@Module({
  imports: [CommonModule],
  providers: [ConfigsService, QueueService],
  exports: [ConfigsService],
})
export class ProvidersModule {}
