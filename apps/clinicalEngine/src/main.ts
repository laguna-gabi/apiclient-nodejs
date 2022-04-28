import { NestFactory } from '@nestjs/core';
import { general } from 'config';
import { AppModule } from './app.module';
import { LoggerService } from './common';
import { internalLogs } from '@argus/pandora';
import { EngineService } from './engine';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  process.env.TZ = general.timezone;

  const logger = app.get(LoggerService);

  await app.listen(3002);

  logger.info(
    { lastCommit: internalLogs.lastCommit.replace('@hash@', process.env.COMMIT_SHA) },
    'Main',
    bootstrap.name,
  );

  // manual run
  const engine = app.get(EngineService);
  await engine.handleEvent({ memberId: '11111' });
}
bootstrap();
