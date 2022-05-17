import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import {
  AnalyticsCommand,
  AnalyticsModule,
  GeneralCommand,
  GeneralModule,
  MigrationCommand,
  MigrationModule,
} from '.';
import { DbModule } from '../src/db/db.module';
import { ProvidersModule } from '../src/providers';

@Module({
  imports: [
    DbModule,
    AnalyticsModule,
    MigrationModule,
    GeneralModule,
    EventEmitterModule.forRoot(),
    ProvidersModule,
  ],
  providers: [AnalyticsCommand, MigrationCommand, GeneralCommand], // add your commands here (https://docs.nestjs.com/recipes/nest-commander)
})
export class CmdModule {}
