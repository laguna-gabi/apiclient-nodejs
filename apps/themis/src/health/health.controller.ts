import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { QueueService } from '../providers';

@Controller('health')
export class HealthController {
  constructor(private health: HealthCheckService, private queueService: QueueService) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([async () => this.queueService.isHealthy()]);
  }
}
