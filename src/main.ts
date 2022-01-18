import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { general } from 'config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

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

  await app.listen(3001);
}
bootstrap();
