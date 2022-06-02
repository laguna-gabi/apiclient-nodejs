import {
  AppRequestContext,
  TcpAuthInterceptor,
  internalLogs,
  requestContextMiddleware,
} from '@argus/pandora';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory, Reflector } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { general, services } from 'config';
import { AppModule } from './app.module';
import { GlobalAuthGuard, RolesGuard } from './auth';
import { AllExceptionsFilter, LoggerService } from './common';

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

  app.use(requestContextMiddleware(AppRequestContext));

  app.useGlobalInterceptors(new TcpAuthInterceptor());

  process.env.TZ = general.get('timezone');

  app.connectMicroservice<MicroserviceOptions>(
    {
      transport: Transport.TCP,
      options: {
        host: '0.0.0.0',
        port: services.hepius.tcpPort,
      },
    },
    { inheritAppConfig: true },
  );

  await app.startAllMicroservices();

  await app.listen(services.hepius.port);

  logger.info(
    { lastCommit: internalLogs.lastCommit.replace('@hash@', process.env.COMMIT_SHA) },
    'Main',
    bootstrap.name,
  );
}

bootstrap();
