import { Module } from '@nestjs/common';
import { AvailabilityService, AvailabilityResolver, Availability, AvailabilityDto } from '.';
import { MongooseModule } from '@nestjs/mongoose';
import { CommonModule } from '../common';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Availability.name, schema: AvailabilityDto }]),
    CommonModule,
  ],
  providers: [AvailabilityService, AvailabilityResolver],
})
export class AvailabilityModule {}
