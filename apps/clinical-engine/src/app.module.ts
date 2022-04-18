import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { CommonModule } from './common';
import { HealthController } from './health/health.controller';

@Module({
  imports: [CommonModule, TerminusModule],
  controllers: [HealthController],
})
export class AppModule {}
