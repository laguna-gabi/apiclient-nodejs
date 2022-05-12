import { internalLogs } from '@argus/pandora';
import { NestFactory } from '@nestjs/core';
import { general, services } from 'config';
import { AppModule } from './app.module';
import { LoggerService } from './common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  process.env.TZ = general.timezone;

  const logger = app.get(LoggerService);

  await app.listen(services.poseidon.port);

  logger.info(
    { lastCommit: internalLogs.lastCommit.replace('@hash@', process.env.COMMIT_SHA) },
    'Main',
    bootstrap.name,
  );
}
bootstrap();
