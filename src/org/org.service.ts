import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateOrgParams, Org, OrgDocument } from '.';
import { BaseService, DbErrors, Errors, ErrorType, Identifier } from '../common';

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
      const { _id } = await this.orgModel.create(createOrgParams);
      return { id: _id };
    } catch (ex) {
      throw new Error(
        ex.code === DbErrors.duplicateKey ? Errors.get(ErrorType.orgAlreadyExists) : ex,
      );
    }
  }

  async get(id: string): Promise<Org> {
    const org = await this.orgModel.findById(id);
    return this.replaceId(org);
  }
}
