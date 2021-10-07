import { Module } from '@nestjs/common';
import { InternalSchedulerDto, InternalSchedulerService, Scheduler } from '.';
import { MongooseModule } from '@nestjs/mongoose';

@Module({
  imports: [MongooseModule.forFeature([{ name: Scheduler.name, schema: InternalSchedulerDto }])],
  providers: [InternalSchedulerService],
  exports: [InternalSchedulerService],
})
export class InternalSchedulerModule {}
