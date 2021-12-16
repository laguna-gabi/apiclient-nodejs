import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { AnalyticsCommand, AnalyticsModule } from '.';
import { DbModule } from '../src/db/db.module';

@Module({
  imports: [DbModule, AnalyticsModule, EventEmitterModule.forRoot(), ScheduleModule.forRoot()],
  providers: [AnalyticsCommand], // add your commands here (https://docs.nestjs.com/recipes/nest-commander)
})
export class CmdModule {}
