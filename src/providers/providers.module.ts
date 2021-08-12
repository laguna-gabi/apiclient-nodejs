import { Module } from '@nestjs/common';
import { SendBird } from './sendBird';
import { Storage } from './aws';

@Module({
  providers: [SendBird, Storage],
  exports: [SendBird, Storage],
})
export class ProvidersModule {}
