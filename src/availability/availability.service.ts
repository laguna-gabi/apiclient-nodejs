import { Injectable } from '@nestjs/common';
import { Availability, AvailabilityDocument, AvailabilityInput } from '.';
import { Model, Types } from 'mongoose';
import { cloneDeep } from 'lodash';
import { InjectModel } from '@nestjs/mongoose';

@Injectable()
export class AvailabilityService {
  constructor(
    @InjectModel(Availability.name) private readonly availabilityModel: Model<AvailabilityDocument>,
  ) {}

  async create(params: AvailabilityInput[]): Promise<void> {
    const items = params.map((input) => {
      const { userId } = input;
      const primitiveValues = cloneDeep(input);
      delete primitiveValues.userId;

      return { ...primitiveValues, userId: new Types.ObjectId(userId) };
    });

    await this.availabilityModel.insertMany(items);
  }
}
