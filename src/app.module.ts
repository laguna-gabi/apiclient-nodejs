import { Module } from '@nestjs/common';
import { DbModule } from './db/db.module';
import { ProvidersModule } from './providers';
import { TriggersModule } from './triggers';

@Module({
  imports: [ProvidersModule, DbModule, TriggersModule],
})
export class AppModule {}
