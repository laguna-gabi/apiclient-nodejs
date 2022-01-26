import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import * as mongooseDelete from 'mongoose-delete';
import { useFactoryOptions } from '../db';
import {
  Barrier,
  BarrierDto,
  CarePlan,
  CarePlanDto,
  CareResolver,
  CareService,
  RedFlag,
  RedFlagDto,
} from '.';
import { CommonModule } from '../common';

@Module({
  imports: [
    CommonModule,
    MongooseModule.forFeatureAsync([
      {
        name: RedFlag.name,
        useFactory: () => {
          return RedFlagDto.plugin(mongooseDelete, useFactoryOptions);
        },
      },
      {
        name: Barrier.name,
        useFactory: () => {
          return BarrierDto.plugin(mongooseDelete, useFactoryOptions);
        },
      },
      {
        name: CarePlan.name,
        useFactory: () => {
          return CarePlanDto.plugin(mongooseDelete, useFactoryOptions);
        },
      },
    ]),
  ],
  providers: [CareService, CareResolver],
})
export class CareModule {}
