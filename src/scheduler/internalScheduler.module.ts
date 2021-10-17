import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { InternalSchedulerDto, InternalSchedulerService, Scheduler } from '.';

@Module({
  imports: [MongooseModule.forFeature([{ name: Scheduler.name, schema: InternalSchedulerDto }])],
  providers: [InternalSchedulerService],
  exports: [InternalSchedulerService],
})
export class InternalSchedulerModule {}
