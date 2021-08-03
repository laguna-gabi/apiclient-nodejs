import { Injectable } from '@nestjs/common';
import { Availability, AvailabilityDocument, AvailabilityInput } from '.';
import { Model, Types } from 'mongoose';
import { cloneDeep } from 'lodash';
import { InjectModel } from '@nestjs/mongoose';
import { Identifiers } from '../common';

@Injectable()
export class AvailabilityService {
  constructor(
    @InjectModel(Availability.name) private readonly availabilityModel: Model<AvailabilityDocument>,
  ) {}

  async create(params: AvailabilityInput[]): Promise<Identifiers> {
    const items = params.map((input) => {
      const { userId } = input;
      const primitiveValues = cloneDeep(input);
      delete primitiveValues.userId;

      return { ...primitiveValues, userId: new Types.ObjectId(userId) };
    });

    const result = await this.availabilityModel.insertMany(items);

    return { ids: result.map((item) => item._id) };
  }
}
