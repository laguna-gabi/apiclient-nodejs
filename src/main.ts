import { ValidationPipe } from '@nestjs/common';
import { NestFactory, Reflector } from '@nestjs/core';
import * as packageJson from '../package.json';
import { AppModule } from './app.module';
import { GlobalAuthGuard, RolesGuard } from './auth';
import { AllExceptionsFilter, LoggerService, internalLogs } from './common';
import { general } from 'config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { logger: ['log'], bodyParser: false });

  app.enableCors();

  const logger = app.get(LoggerService);
  app.useGlobalFilters(new AllExceptionsFilter(logger));
  app.useGlobalPipes(new ValidationPipe({ transform: true })); //Transform is for rest api

  // Guard ALL routes (GQL and REST) - new routes must be explicitly annotated
  const reflector = app.get(Reflector);
  app.useGlobalGuards(new GlobalAuthGuard());
  app.useGlobalGuards(new RolesGuard(reflector));

  process.env.TZ = general.get('timezone');

  await app.listen(3000);

  logger.info(
    { hepiusVersion: internalLogs.hepiusVersion.replace('@version@', packageJson.version) },
    'Main',
    bootstrap.name,
  );
  logger.info(
    { lastCommit: internalLogs.lastCommit.replace('@hash@', process.env.COMMIT_SHA) },
    'Main',
    bootstrap.name,
  );
}

bootstrap();
