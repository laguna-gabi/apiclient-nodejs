import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  BarrierDto,
  BarrierTypeDto,
  CarePlanDto,
  CarePlanTypeDto,
  CareResolver,
  CareService,
  RedFlag,
  RedFlagDto,
  RedFlagType,
  RedFlagTypeDto,
} from '.';
import { CommonModule, LoggerService } from '../common';
import { Barrier, BarrierType, CarePlan, CarePlanType } from '@argus/hepiusClient';
import { CareTcpController } from './care.tcp.controller';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ChangeEventFactoryProvider } from '../db';
import { EntityName } from '@argus/pandora';
@Module({
  imports: [
    CommonModule,
    MongooseModule.forFeature([
      { name: CarePlanType.name, schema: CarePlanTypeDto },
      { name: BarrierType.name, schema: BarrierTypeDto },
      { name: RedFlag.name, schema: RedFlagDto },
      { name: RedFlagType.name, schema: RedFlagTypeDto },
      { name: CarePlan.name, schema: CarePlanDto },
    ]),
    MongooseModule.forFeatureAsync([
      {
        name: Barrier.name,
        imports: [CommonModule],
        useFactory: ChangeEventFactoryProvider(EntityName.barrier, BarrierDto, 'memberId'),
        inject: [EventEmitter2, LoggerService],
      },
    ]),
  ],
  providers: [CareService, CareResolver],
  controllers: [CareTcpController],
  exports: [MongooseModule],
})
export class CareModule {}
