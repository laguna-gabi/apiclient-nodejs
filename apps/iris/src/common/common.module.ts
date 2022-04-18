import { PinoHttpConfig } from '@argus/pandora';
import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { LoggerService } from '.';

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
