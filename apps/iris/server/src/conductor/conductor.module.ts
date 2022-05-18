import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import * as mongooseDelete from 'mongoose-delete';
import {
  ConductorService,
  Dispatch,
  DispatchDto,
  DispatchesService,
  QueueService,
  Trigger,
  TriggerDto,
  TriggersService,
} from '.';
import { CommonModule } from '../common';
import { useFactoryOptions } from '../db';
import { ProvidersModule } from '../providers';
import { SettingsModule } from '../settings';

@Module({
  imports: [
    ProvidersModule,
    CommonModule,
    SettingsModule,
    MongooseModule.forFeature([{ name: Trigger.name, schema: TriggerDto }]),
    MongooseModule.forFeatureAsync([
      {
        name: Dispatch.name,
        useFactory: () => {
          return DispatchDto.plugin(mongooseDelete, useFactoryOptions);
        },
      },
    ]),
  ],
  providers: [ConductorService, QueueService, DispatchesService, TriggersService],
  exports: [QueueService, DispatchesService],
})
export class ConductorModule {}
