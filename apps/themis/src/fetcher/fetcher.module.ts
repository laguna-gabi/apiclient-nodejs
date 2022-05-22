import { Module } from '@nestjs/common';
import { ProvidersModule } from '../providers';
import { FetcherService } from './fetcher.service';
import { CommonModule } from '../common';

@Module({
  imports: [CommonModule, ProvidersModule],
  providers: [FetcherService],
  exports: [FetcherService],
})
export class FetcherModule {}
