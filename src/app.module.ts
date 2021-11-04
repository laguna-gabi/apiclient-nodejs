import { Module } from '@nestjs/common';
import { DbModule } from './db/db.module';
import { TriggersModule } from './triggers';

@Module({
  imports: [DbModule, TriggersModule],
})
export class AppModule {}
