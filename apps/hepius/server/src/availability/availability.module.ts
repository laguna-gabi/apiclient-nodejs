import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Availability, AvailabilityDto, AvailabilityResolver, AvailabilityService } from '.';
import { CommonModule } from '../common';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Availability.name, schema: AvailabilityDto }]),
    CommonModule,
  ],
  providers: [AvailabilityService, AvailabilityResolver],
})
export class AvailabilityModule {}
