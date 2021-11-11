import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { TriggersService } from './triggers';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(3001);

  const triggersService = app.get<TriggersService>(TriggersService);
  await triggersService.doSomething();
}
bootstrap();
