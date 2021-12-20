import { Module } from '@nestjs/common';
import { InternationalizationService, LoggerService } from '.';
import { LoggerModule } from 'nestjs-pino';
import { PinoHttpConfig } from '@lagunahealth/pandora';

@Module({
  providers: [LoggerService, InternationalizationService],
  exports: [LoggerService, InternationalizationService],
  imports: [
    LoggerModule.forRoot({
      pinoHttp: PinoHttpConfig,
    }),
  ],
})
export class CommonModule {}
