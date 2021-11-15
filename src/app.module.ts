import { Module } from '@nestjs/common';
import { DbModule } from './db/db.module';
import { ProvidersModule } from './providers';
import { TriggersModule } from './triggers';
import { SettingsModule } from './settings';
import { DispatchesModule } from './dispatches';

@Module({
  imports: [ProvidersModule, DbModule, TriggersModule, SettingsModule, DispatchesModule],
})
export class AppModule {}
