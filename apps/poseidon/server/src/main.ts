import { internalLogs } from '@argus/pandora';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { general, services } from 'config';
import { AppModule } from './app.module';
import { AllExceptionsFilter, LoggerService } from './common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.TCP,
    options: {
      host: '0.0.0.0',
      port: services.poseidon.tcpPort,
    },
  });

  process.env.TZ = general.timezone;

  const logger = app.get(LoggerService);
  app.useGlobalFilters(new AllExceptionsFilter(logger));

  await app.listen(services.poseidon.port);
  await app.startAllMicroservices();

  logger.info(
    { lastCommit: internalLogs.lastCommit.replace('@hash@', process.env.COMMIT_SHA) },
    'Main',
    bootstrap.name,
  );
}
bootstrap();
