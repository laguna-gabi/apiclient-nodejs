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
import { CommonModule } from '../common';
import { Barrier, BarrierType, CarePlan, CarePlanType } from '@argus/hepiusClient';
import { CareTcpController } from './care.tcp.controller';

@Module({
  imports: [
    CommonModule,
    MongooseModule.forFeature([
      { name: CarePlanType.name, schema: CarePlanTypeDto },
      { name: BarrierType.name, schema: BarrierTypeDto },
      { name: RedFlag.name, schema: RedFlagDto },
      { name: RedFlagType.name, schema: RedFlagTypeDto },
      { name: Barrier.name, schema: BarrierDto },
      { name: CarePlan.name, schema: CarePlanDto },
    ]),
  ],
  providers: [CareService, CareResolver],
  controllers: [CareTcpController],
  exports: [MongooseModule],
})
export class CareModule {}
