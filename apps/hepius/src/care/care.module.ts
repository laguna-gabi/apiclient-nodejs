import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Barrier,
  BarrierDto,
  BarrierType,
  BarrierTypeDto,
  CarePlan,
  CarePlanDto,
  CarePlanType,
  CarePlanTypeDto,
  CareResolver,
  CareService,
  RedFlag,
  RedFlagDto,
  RedFlagType,
  RedFlagTypeDto,
} from '.';
import { CommonModule } from '../common';

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
  exports: [MongooseModule],
})
export class CareModule {}
