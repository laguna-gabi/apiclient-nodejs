import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { AppointmentScheduler } from './appointment';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  app.useGlobalPipes(new ValidationPipe({ transform: true })); //Transform is for rest api
  await app.listen(3000);

  /**
   * Registering reminders for all scheduled appointments
   * DON'T DELETE THIS!
   */
  const appointmentScheduler = app.get<AppointmentScheduler>(AppointmentScheduler);
  await appointmentScheduler.init();
}

bootstrap();
