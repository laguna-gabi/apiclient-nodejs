import { BaseLogger } from '@lagunahealth/pandora';
import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ConfigsService, OneSignal, Slack, Twilio } from '.';

@Module({
  imports: [HttpModule],
  providers: [ConfigsService, Slack, BaseLogger, OneSignal, Twilio],
  exports: [ConfigsService],
})
export class ProvidersModule {}
