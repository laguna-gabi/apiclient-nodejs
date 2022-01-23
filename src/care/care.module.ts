import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Barrier, BarrierDto, CarePlan, CarePlanDto, CareService, RedFlag, RedFlagDto } from '.';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: RedFlag.name, schema: RedFlagDto },
      { name: Barrier.name, schema: BarrierDto },
      { name: CarePlan.name, schema: CarePlanDto },
    ]),
  ],
  providers: [CareService],
})
export class CareModule {}
