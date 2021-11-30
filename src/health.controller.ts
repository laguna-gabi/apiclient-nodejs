import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService, MongooseHealthIndicator } from '@nestjs/terminus';
import { QueueService } from './conductor';

@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private queueService: QueueService,
    private mongoose: MongooseHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      async () => this.queueService.isHealthy(),
      async () => this.mongoose.pingCheck('mongoose'),
    ]);
  }
}
