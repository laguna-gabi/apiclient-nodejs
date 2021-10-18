import { ValidationPipe } from '@nestjs/common';
import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { AppointmentScheduler } from './appointment';
import { GlobalAuthGuard } from './auth/guards/globalAuth.guard';
import { RolesGuard } from './auth/guards/role.guard';
import { MemberScheduler } from './member';
import * as packageJson from '../package.json';
import { Logger, internalLogs } from './common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors();

  app.useGlobalPipes(new ValidationPipe({ transform: true })); //Transform is for rest api

  // Guard ALL routes (GQL and REST) - new routes must be explicitly annotated
  const reflector = app.get(Reflector);
  app.useGlobalGuards(new GlobalAuthGuard());
  app.useGlobalGuards(new RolesGuard(reflector));

  await app.listen(3000);

  const logger = app.get<Logger>(Logger);
  logger.internal(
    internalLogs.hepiusVersion.replace('@version@', packageJson.version),
    'Main',
    bootstrap.name,
  );
  logger.internal(
    internalLogs.lastCommit.replace('@hash@', process.env.COMMIT_SHA),
    'Main',
    bootstrap.name,
  );

  /**
   * Registering reminders for all scheduled notifications
   * DON'T DELETE THIS!
   */
  const appointmentScheduler = app.get<AppointmentScheduler>(AppointmentScheduler);
  const memberScheduler = app.get<MemberScheduler>(MemberScheduler);
  await appointmentScheduler.init();
  await memberScheduler.init();
}

bootstrap();
