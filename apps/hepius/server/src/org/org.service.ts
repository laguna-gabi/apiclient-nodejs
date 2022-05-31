import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateOrgParams, Org, OrgDocument } from '.';
import { BaseService, DbErrors, ErrorType, Errors } from '../common';
import { Identifier } from '@argus/hepiusClient';

@Injectable()
export class OrgService extends BaseService {
  constructor(
    @InjectModel(Org.name)
    private readonly orgModel: Model<OrgDocument>,
  ) {
    super();
  }

  async insert(createOrgParams: CreateOrgParams): Promise<Identifier> {
    try {
      const { id } = await this.orgModel.create(createOrgParams);
      return { id };
    } catch (ex) {
      throw new Error(
        ex.code === DbErrors.duplicateKey ? Errors.get(ErrorType.orgAlreadyExists) : ex,
      );
    }
  }

  async get(id: string): Promise<Org | null> {
    const org = await this.orgModel.findById(id);
    return org;
  }

  async getByCode(code: string): Promise<Org | null> {
    const org = await this.orgModel.findOne({ code });
    return org ? org.toObject() : null;
  }

  async getOrgs(): Promise<Org[]> {
    return this.orgModel.find();
  }
}
