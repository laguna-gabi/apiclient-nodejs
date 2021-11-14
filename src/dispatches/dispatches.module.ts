import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Dispatch, DispatchDto, DispatchesService } from '.';

@Module({
  imports: [MongooseModule.forFeature([{ name: Dispatch.name, schema: DispatchDto }])],
  providers: [DispatchesService],
})
export class DispatchesModule {}
