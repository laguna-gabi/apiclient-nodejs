import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AnalyticsCommand, AnalyticsModule, MigrationCommand, MigrationModule } from '.';
import { DbModule } from '../src/db/db.module';

@Module({
  imports: [DbModule, AnalyticsModule, MigrationModule, EventEmitterModule.forRoot()],
  providers: [AnalyticsCommand, MigrationCommand], // add your commands here (https://docs.nestjs.com/recipes/nest-commander)
})
export class CmdModule {}
