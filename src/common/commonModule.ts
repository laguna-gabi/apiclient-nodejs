import { Module } from '@nestjs/common';
import { InternationalizationService, Logger } from '.';

@Module({
  providers: [Logger, InternationalizationService],
  exports: [Logger, InternationalizationService],
})
export class CommonModule {}
