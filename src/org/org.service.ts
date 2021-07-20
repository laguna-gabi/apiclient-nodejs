import { Injectable } from '@nestjs/common';
import { CreateOrgParams, Org, OrgDocument } from '.';
import { DbErrors, Errors, ErrorType, Identifier } from '../common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

@Injectable()
export class OrgService {
  constructor(
    @InjectModel(Org.name)
    private readonly orgModel: Model<OrgDocument>,
  ) {}

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
}
