import { ValidationPipe } from '@nestjs/common';
import { NestFactory, Reflector } from '@nestjs/core';
import * as packageJson from '../package.json';
import { AppModule } from './app.module';
import { AppointmentScheduler } from './appointment';
import { AuthService, GlobalAuthGuard, RolesGuard } from './auth';
import { AllExceptionsFilter, Logger, internalLogs } from './common';
import { MemberScheduler } from './member';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { logger: true, bodyParser: false });

  app.enableCors();

  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalPipes(new ValidationPipe({ transform: true })); //Transform is for rest api

  // Guard ALL routes (GQL and REST) - new routes must be explicitly annotated
  const reflector = app.get(Reflector);
  app.useGlobalGuards(new GlobalAuthGuard());
  app.useGlobalGuards(new RolesGuard(reflector, app.get(AuthService)));

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
