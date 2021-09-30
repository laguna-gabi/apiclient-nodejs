import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { Logger } from './common';
import { SchedulerService } from './scheduler';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { logger: new Logger('Main') });
  app.enableCors();
  app.useGlobalPipes(new ValidationPipe({ transform: true })); //Transform is for rest api
  await app.listen(3000);

  /**
   * Registering reminders for all scheduled notifiactions
   * DON'T DELETE THIS!
   */
  const schedulerService = app.get<SchedulerService>(SchedulerService);
  await schedulerService.init();
}

bootstrap();
