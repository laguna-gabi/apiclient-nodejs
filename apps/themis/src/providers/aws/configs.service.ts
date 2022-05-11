import { BaseConfigs, BaseExternalConfigs } from '@argus/pandora';
import { Injectable } from '@nestjs/common';
import { aws } from 'config';

export const ExternalConfigs = BaseExternalConfigs;

@Injectable()
export class ConfigsService extends BaseConfigs {
  constructor() {
    super(aws.region);
  }
}
