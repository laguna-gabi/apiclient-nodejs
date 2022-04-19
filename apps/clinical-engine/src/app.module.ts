import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { CommonModule } from './common';
import { HealthController } from './health/health.controller';
import { EngineModule } from './engine/engine.module';

@Module({
  imports: [CommonModule, TerminusModule, EngineModule],
  controllers: [HealthController],
})
export class AppModule {}
