import { Module } from '@nestjs/common';
import { LoggerService } from '.';
import { LoggerModule } from 'nestjs-pino';
import { PinoHttpConfig } from '@lagunahealth/pandora';

@Module({
  providers: [LoggerService],
  exports: [LoggerService],
  imports: [
    LoggerModule.forRoot({
      pinoHttp: PinoHttpConfig,
    }),
  ],
})
export class CommonModule {}
