import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { CommonModule } from './common';
import { HealthController } from './health';
import { EngineModule } from './engine';

@Module({
  imports: [CommonModule, TerminusModule, EngineModule],
  controllers: [HealthController],
})
export class AppModule {}
