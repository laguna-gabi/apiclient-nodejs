import { Platform } from '@argus/pandora';
import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import compareVersions, { compare, validate } from 'compare-versions';
import { Model } from 'mongoose';
import {
  CheckMobileVersionResponse,
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

  async checkMobileVersion(params: {
    version: string;
    platform: Platform;
    build: string;
  }): Promise<CheckMobileVersionResponse> {
    const { version, platform } = params;

    if (!validate(version)) {
      throw new BadRequestException(Errors.get(ErrorType.configurationMobileVersionInvalidVersion));
    }

    const latestVersion = await this.getLatestVersion(platform);
    const [minVersion, mobileVersion] = await Promise.all([
      this.mobileVersionModel.findOne({ minVersion: true, platform }),
      this.mobileVersionModel.findOne({ version, platform }),
    ]);

    const forceUpdate = mobileVersion?.faultyVersion || compare(version, minVersion.version, '<');
    const updateAvailable = forceUpdate || compare(version, latestVersion, '<');

    return {
      latestVersion,
      forceUpdate,
      updateAvailable,
    };
  }

  private async getLatestVersion(platform: Platform): Promise<string> {
    const mobileVersions = await this.mobileVersionModel.find({ platform });
    return mobileVersions
      .map((mobileVersion) => mobileVersion.version)
      .sort(compareVersions)
      .at(-1);
  }
}
