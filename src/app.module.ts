import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { DbModule } from './db';
import { ProvidersModule } from './providers';
import { SettingsModule } from './settings';
import { ConductorModule } from './conductor';
import { HealthController } from './health.controller';
import { TerminusModule } from '@nestjs/terminus';

@Module({
  imports: [
    EventEmitterModule.forRoot(),
    TerminusModule,
    DbModule,
    ProvidersModule,
    SettingsModule,
    ConductorModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
