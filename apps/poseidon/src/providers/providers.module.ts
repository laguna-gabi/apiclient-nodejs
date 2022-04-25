import { Module } from '@nestjs/common';
import { CommonModule } from '../common';
import { ConfigsService } from './aws';

@Module({
  imports: [CommonModule],
  providers: [ConfigsService],
  exports: [ConfigsService],
})
export class ProvidersModule {}
