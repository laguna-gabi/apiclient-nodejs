import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Availability, AvailabilityDocument, AvailabilityInput, AvailabilitySlot } from '.';
import { ErrorType, Errors, Identifiers } from '../common';
import { queryDaysLimit } from 'config';

@Injectable()
export class AvailabilityService {
  constructor(
    @InjectModel(Availability.name) private readonly availabilityModel: Model<AvailabilityDocument>,
  ) {}

  async create(params: AvailabilityInput[], userId: string): Promise<Identifiers> {
    const items = params.map((input) => {
      return { ...input, userId: new Types.ObjectId(userId) };
    });

    const result = await this.availabilityModel.insertMany(items);
    return { ids: result.map((item) => item._id.toString()) };
  }

  async delete(id: string, deletedBy: string): Promise<boolean> {
    const result = await this.availabilityModel.findById(new Types.ObjectId(id));
    if (!result) {
      throw new Error(Errors.get(ErrorType.availabilityNotFound));
    }
    await result.delete(new Types.ObjectId(deletedBy));
    return true;
  }

  async get(): Promise<AvailabilitySlot[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - queryDaysLimit.getAvailabilities);

    return this.availabilityModel.aggregate([
      {
        $project: {
          _id: 0,
          availabilities: '$$ROOT',
        },
      },
      { $match: { 'availabilities.start': { $gt: startDate } } },
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
          userId: '$users._id',
          userName: '$users.firstName',
          _id: 0,
        },
      },
    ]);
  }
}
