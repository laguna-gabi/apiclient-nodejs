import { Module } from '@nestjs/common';
import { Logger } from '.';

@Module({
  providers: [Logger],
  exports: [Logger],
})
export class CommonModule {}
