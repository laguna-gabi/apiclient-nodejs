import { Injectable } from '@nestjs/common';
import * as AWS from 'aws-sdk';
import { ConfigsService, ExternalConfigs } from '.';

@Injectable()
export class StorageService {
  constructor(private readonly configsService: ConfigsService) {}

  private readonly s3 = new AWS.S3({ signatureVersion: 'v4', apiVersion: '2006-03-01' });

  async getUrl(fileName: string): Promise<string | undefined> {
    console.log(`1 getUrl fileName = ${fileName}`);
    const bucket = await this.configsService.getConfig(ExternalConfigs.awsStorageMember);
    console.log(`2 getUrl bucket = ${fileName}`);
    const params = { Bucket: bucket, Key: `public/documents/${fileName}` };
    console.log(`3 getUrl params = ${params}`);

    try {
      console.log(`4a getUrl before headObject`);
      await this.s3.headObject(params).promise();
      console.log(`4b getUrl before headObject`);
    } catch (ex) {
      console.log(`4c getUrl exception ${ex}`);
      //file doesn't exist
      return undefined;
    }

    console.log(`5 getUrl before getSignedUrlPromise`);
    //Expires in 3 hours
    const result = await this.s3.getSignedUrlPromise('getObject', {
      ...params,
      Expires: 3 * 60 * 60,
    });

    console.log(`6 getUrl after getSignedUrlPromise ${result}`);
    return result;
  }
}
