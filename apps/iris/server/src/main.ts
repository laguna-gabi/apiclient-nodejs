import { internalLogs } from '@argus/pandora';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { general, services } from 'config';
import { AppModule } from './app.module';
import { LoggerService } from './common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  process.env.TZ = general.timezone;

  const config = new DocumentBuilder()
    .setTitle('Iris')
    .setDescription('The Iris API description')
    .setVersion('1.0')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  const logger = app.get(LoggerService);

  await app.listen(services.iris.port);

  logger.info(
    { lastCommit: internalLogs.lastCommit.replace('@hash@', process.env.COMMIT_SHA) },
    'Main',
    bootstrap.name,
  );
}
bootstrap();
