import { BaseStorage, Environments } from '@argus/pandora';
import { Injectable } from '@nestjs/common';
import { ConfigsService, ExternalConfigs } from '.';
import { aws } from 'config';
import { LoggerService } from '../../common';

@Injectable()
export class StorageService extends BaseStorage {
  constructor(readonly logger: LoggerService, private readonly configsService: ConfigsService) {
    super(aws.region);
  }

  async onModuleInit(): Promise<void> {
    this.bucket =
      !process.env.NODE_ENV || process.env.NODE_ENV === Environments.test
        ? aws.storage.bucket
        : await this.configsService.getConfig(ExternalConfigs.aws.memberBucketName);
  }
}
