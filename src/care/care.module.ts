import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RedFlag, RedFlagDto } from '.';

@Module({
  imports: [MongooseModule.forFeature([{ name: RedFlag.name, schema: RedFlagDto }])],
})
export class CareModule {}
