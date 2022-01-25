import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Barrier,
  BarrierDto,
  CarePlan,
  CarePlanDto,
  CareResolver,
  CareService,
  RedFlag,
  RedFlagDto,
} from '.';
import { CommonModule } from '../common';

@Module({
  imports: [
    CommonModule,
    MongooseModule.forFeature([
      { name: RedFlag.name, schema: RedFlagDto },
      { name: Barrier.name, schema: BarrierDto },
      { name: CarePlan.name, schema: CarePlanDto },
    ]),
  ],
  providers: [CareService, CareResolver],
})
export class CareModule {}
