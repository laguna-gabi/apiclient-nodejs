import { Module } from '@nestjs/common';
import { AvailabilityService, AvailabilityResolver, Availability, AvailabilityDto } from '.';
import { MongooseModule } from '@nestjs/mongoose';

@Module({
  imports: [MongooseModule.forFeature([{ name: Availability.name, schema: AvailabilityDto }])],
  providers: [AvailabilityService, AvailabilityResolver],
})
export class AvailabilityModule {}
