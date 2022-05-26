import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  CreateMobileVersionParams,
  MobileVersion,
  MobileVersionDocument,
  UpdateFaultyMobileVersionsParams,
  UpdateMinMobileVersionParams,
} from '.';
import { ErrorType, Errors } from '../common';

@Injectable()
export class MobileVersionService {
  constructor(
    @InjectModel(MobileVersion.name)
    private readonly mobileVersionModel: Model<MobileVersionDocument>,
  ) {}

  async createMobileVersion(createMobileVersionParams: CreateMobileVersionParams) {
    const { minVersion, platform } = createMobileVersionParams;
    if (minVersion === true) {
      await this.mobileVersionModel.findOneAndUpdate(
        { minVersion: true, platform },
        { $set: { minVersion: false } },
      );
    }
    await this.mobileVersionModel.create(createMobileVersionParams);
  }

  async updateMinMobileVersion(updateMinMobileVersionParams: UpdateMinMobileVersionParams) {
    const { version, platform } = updateMinMobileVersionParams;
    const mobileVersion = await this.mobileVersionModel.findOne({ version, platform });
    if (!mobileVersion) {
      throw new Error(Errors.get(ErrorType.configurationMobileVersionNotFound));
    }
    await this.mobileVersionModel.findOneAndUpdate(
      { minVersion: true, platform },
      { $set: { minVersion: false } },
    );
    await mobileVersion.updateOne({ $set: { minVersion: true } });
  }

  async updateFaultyMobileVersions(updateFaultyVersionsParams: UpdateFaultyMobileVersionsParams) {
    const { versions, platform } = updateFaultyVersionsParams;
    await this.mobileVersionModel.updateMany(
      { version: { $in: versions }, platform },
      { $set: { faultyVersion: true } },
    );
  }
}
