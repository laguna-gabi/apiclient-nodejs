import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { LoggerService } from '.';
import { PinoHttpConfig } from '@argus/pandora';

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
