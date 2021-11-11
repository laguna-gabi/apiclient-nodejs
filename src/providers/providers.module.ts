import { Module } from '@nestjs/common';
import { ConfigsService } from '.';

@Module({
  providers: [ConfigsService],
  exports: [ConfigsService],
})
export class ProvidersModule {}
