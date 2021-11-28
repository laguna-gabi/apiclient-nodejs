import { Module } from '@nestjs/common';
import { DbModule } from './db';
import { ProvidersModule } from './providers';
import { SettingsModule } from './settings';
import { ConductorModule } from './conductor';

@Module({
  imports: [DbModule, ProvidersModule, SettingsModule, ConductorModule],
})
export class AppModule {}
