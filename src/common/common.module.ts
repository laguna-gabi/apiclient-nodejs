import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { Logger } from '.';
import { PinoHttpConfig } from '@lagunahealth/pandora';

@Module({
  providers: [Logger],
  exports: [Logger],
  imports: [
    LoggerModule.forRoot({
      pinoHttp: PinoHttpConfig
    }),
  ],
})
export class CommonModule {}
