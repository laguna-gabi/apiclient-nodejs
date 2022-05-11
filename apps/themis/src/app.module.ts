import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health';
import { EngineModule } from './engine';
import { ProvidersModule } from './providers';

@Module({
  imports: [TerminusModule, EngineModule, ProvidersModule],
  controllers: [HealthController],
})
export class AppModule {}
