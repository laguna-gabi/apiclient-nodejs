import { BaseStorage, StorageUrlParams } from '@argus/pandora';
import { Injectable } from '@nestjs/common';
import { Body } from 'aws-sdk/clients/s3';
import { aws } from 'config';
import { ConfigsService, ExternalConfigs } from '.';
import { LoggerService } from '../../common';

export interface UploadFileParams extends StorageUrlParams {
  data: Body;
}
@Injectable()
export class StorageService extends BaseStorage {
  constructor(readonly logger: LoggerService, private readonly configsService: ConfigsService) {
    super(aws.region);
  }

  async onModuleInit(): Promise<void> {
    this.bucket = await this.configsService.getEnvConfig({
      external: ExternalConfigs.aws.memberBucketName,
      local: aws.storage.bucket,
    });
  }

  async uploadFile(uploadFileParams: UploadFileParams) {
    const { storageType, memberId, id, data } = uploadFileParams;
    const params = {
      Bucket: this.bucket,
      Key: `public/${storageType}/${memberId}/${id}`,
      Body: data,
    };

    return this.s3.upload(params).promise();
  }
}
