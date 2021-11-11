import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Trigger, TriggersService, TriggerDto } from '.';

@Module({
  imports: [MongooseModule.forFeature([{ name: Trigger.name, schema: TriggerDto }])],
  providers: [TriggersService],
})
export class TriggersModule {}
