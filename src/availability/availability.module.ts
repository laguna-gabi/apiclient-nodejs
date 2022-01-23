import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import * as mongooseDelete from 'mongoose-delete';
import { Availability, AvailabilityDto, AvailabilityResolver, AvailabilityService } from '.';
import { CommonModule } from '../common';
import { useFactoryOptions } from '../db';

@Module({
  imports: [
    MongooseModule.forFeatureAsync([
      {
        name: Availability.name,
        useFactory: () => {
          return AvailabilityDto.plugin(mongooseDelete, useFactoryOptions);
        },
      },
    ]),
    CommonModule,
  ],
  providers: [AvailabilityService, AvailabilityResolver],
})
export class AvailabilityModule {}
