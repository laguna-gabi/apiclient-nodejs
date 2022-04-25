import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { TerminusModule } from '@nestjs/terminus';
import { DbModule } from './db';
import { HealthController } from './health/health.controller';
import { ProvidersModule } from './providers';

@Module({
  imports: [ProvidersModule, DbModule, EventEmitterModule.forRoot(), TerminusModule],
  controllers: [HealthController],
})
export class AppModule {}
