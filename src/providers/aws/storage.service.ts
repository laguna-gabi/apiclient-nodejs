import { Injectable } from '@nestjs/common';
import * as AWS from 'aws-sdk';
import { ConfigsService, ExternalConfigs } from '.';

@Injectable()
export class StorageService {
  constructor(private readonly configsService: ConfigsService) {}

  private readonly s3 = new AWS.S3({ signatureVersion: 'v4', apiVersion: '2006-03-01' });

  async getUrl(fileName: string): Promise<string | undefined> {
    const bucket = await this.configsService.getConfig(ExternalConfigs.awsStorageMember);
    const params = { Bucket: bucket, Key: `public/documents/${fileName}` };

    try {
      await this.s3.headObject(params).promise();
    } catch (ex) {
      //file doesn't exist
      return undefined;
    }

    //Expires in 3 hours
    return this.s3.getSignedUrlPromise('getObject', { ...params, Expires: 3 * 60 * 60 });
  }
}
