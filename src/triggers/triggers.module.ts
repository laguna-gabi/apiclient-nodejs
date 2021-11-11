import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Trigger, TriggerDto, TriggersService } from '.';

@Module({
  imports: [MongooseModule.forFeature([{ name: Trigger.name, schema: TriggerDto }])],
  providers: [TriggersService],
})
export class TriggersModule {}
