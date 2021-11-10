import { Module } from '@nestjs/common';
import { Trigger, TriggersService, TriggerDto } from '.';
import { MongooseModule } from '@nestjs/mongoose';

@Module({
  imports: [MongooseModule.forFeature([{ name: Trigger.name, schema: TriggerDto }])],
  providers: [TriggersService],
})
export class TriggersModule {}
