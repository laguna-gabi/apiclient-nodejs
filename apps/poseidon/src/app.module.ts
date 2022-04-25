import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { TerminusModule } from '@nestjs/terminus';
import { DbModule } from './db';
import { HealthController } from './health/health.controller';
import { ProvidersModule } from './providers';
import { TranscriptModule } from './transcript';

@Module({
  imports: [
    EventEmitterModule.forRoot(),
    TerminusModule,
    DbModule,
    ProvidersModule,
    TranscriptModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
