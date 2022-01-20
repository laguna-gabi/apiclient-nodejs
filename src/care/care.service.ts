import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateRedFlagParams, RedFlag, RedFlagDocument } from '.';
import { Identifier } from '../common';

@Injectable()
export class CareService {
  constructor(
    @InjectModel(RedFlag.name)
    private readonly redFlagModel: Model<RedFlagDocument>,
  ) {}

  /**************************************************************************************************
   ******************************************** Red Flag ********************************************
   *************************************************************************************************/

  async createRedFlag(createRedFlagParams: CreateRedFlagParams): Promise<Identifier> {
    const { memberId, createdBy } = createRedFlagParams;
    return this.redFlagModel.create({
      ...createRedFlagParams,
      memberId: new Types.ObjectId(memberId),
      createdBy: new Types.ObjectId(createdBy),
    });
  }

  async getMemberRedFlags(memberId: string): Promise<RedFlag[]> {
    return this.redFlagModel.find({ memberId: new Types.ObjectId(memberId) });
  }
}
