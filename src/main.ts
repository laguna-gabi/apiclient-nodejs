import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { general } from 'config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  process.env.TZ = general.timezone;

  await app.listen(3001);
}
bootstrap();
