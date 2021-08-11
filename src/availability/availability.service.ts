import { Injectable } from '@nestjs/common';
import { Availability, AvailabilityDocument, AvailabilityInput, AvailabilitySlot } from '.';
import { Model } from 'mongoose';
import { cloneDeep } from 'lodash';
import { InjectModel } from '@nestjs/mongoose';
import { Errors, ErrorType, Identifiers } from '../common';

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

      return { ...primitiveValues, userId };
    });

    const result = await this.availabilityModel.insertMany(items);
    return { ids: result.map((item) => item._id) };
  }

  async delete(id: string): Promise<void> {
    const result = await this.availabilityModel.deleteOne({ _id: id });

    if (result.deletedCount === 0) {
      throw new Error(Errors.get(ErrorType.availabilityNotFound));
    }
  }

  async get(): Promise<AvailabilitySlot[]> {
    return this.availabilityModel.aggregate([
      {
        $project: {
          _id: 0,
          availabilities: '$$ROOT',
        },
      },
      {
        $lookup: {
          localField: 'availabilities.userId',
          from: 'users',
          foreignField: '_id',
          as: 'users',
        },
      },
      {
        $sort: {
          'availabilities.start': 1,
        },
      },
      {
        $unwind: {
          path: '$users',
          preserveNullAndEmptyArrays: false,
        },
      },
      {
        $project: {
          id: '$availabilities._id',
          start: '$availabilities.start',
          end: '$availabilities.end',
          userId: '$availabilities.userId',
          userName: '$users.firstName',
          _id: 0,
        },
      },
    ]);
  }
}
