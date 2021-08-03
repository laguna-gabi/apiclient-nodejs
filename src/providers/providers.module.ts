import { Module } from '@nestjs/common';
import { SendBird } from './sendBird';

@Module({
  providers: [SendBird],
  exports: [SendBird],
})
export class ProvidersModule {}
