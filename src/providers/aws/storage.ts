import { Injectable } from '@nestjs/common';
import * as AWS from 'aws-sdk';
import * as config from 'config';

@Injectable()
export class Storage {
  private readonly s3 = new AWS.S3({ signatureVersion: 'v4', apiVersion: '2006-03-01' });

  async getUrl(fileName: string): Promise<string | undefined> {
    console.error('hadas getUrl');
    const params = {
      Bucket: config.get('providers.aws.storage.memberBucketName'),
      Key: `public/${fileName}`,
    };

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
