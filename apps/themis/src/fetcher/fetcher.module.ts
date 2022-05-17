import { Module } from '@nestjs/common';
import { ProvidersModule } from '../providers';
import { FetcherService } from './fetcher.service';

@Module({
  imports: [ProvidersModule],
  providers: [FetcherService],
  exports: [FetcherService],
})
export class FetcherModule {}
