import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Barrier, BarrierDto, RedFlag, RedFlagDto } from '.';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: RedFlag.name, schema: RedFlagDto },
      { name: Barrier.name, schema: BarrierDto },
    ]),
  ],
})
export class CareModule {}
