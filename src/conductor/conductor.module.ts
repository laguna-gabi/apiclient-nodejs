import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CommonModule } from '../common';
import { ProvidersModule } from '../providers';
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
import { SettingsModule } from '../settings';

@Module({
  imports: [
    ProvidersModule,
    CommonModule,
    SettingsModule,
    MongooseModule.forFeature([{ name: Trigger.name, schema: TriggerDto }]),
    MongooseModule.forFeature([{ name: Dispatch.name, schema: DispatchDto }]),
  ],
  providers: [ConductorService, QueueService, DispatchesService, TriggersService],
})
export class ConductorModule {}
