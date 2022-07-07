import { OnModuleInit } from '@nestjs/common';
import { S3 } from 'aws-sdk';
import { hosts } from 'config';
import { isOperationalEnv } from '../..';

export enum StorageType {
  documents = 'documents',
  recordings = 'recordings',
  journals = 'journals',
  general = 'general',
  transcripts = 'transcripts',
}

export interface StorageUrlParams {
  storageType: StorageType;
  memberId: string;
  id: string;
}

export abstract class BaseStorage implements OnModuleInit {
  protected s3: S3;
  protected bucket: string;

  abstract onModuleInit(): Promise<void>;

  protected constructor(awsRegion: string) {
    this.s3 = new S3({
      signatureVersion: 'v4',
      apiVersion: '2006-03-01',
      region: awsRegion,
      ...(!isOperationalEnv()
        ? {
            endpoint: hosts.localstack,
            s3ForcePathStyle: true,
          }
        : {}),
    });
  }

  async getDownloadUrl(urlParams: StorageUrlParams): Promise<string | undefined> {
    const { storageType, memberId, id } = urlParams;
    const params = { Bucket: this.bucket, Key: `public/${storageType}/${memberId}/${id}` };

    try {
      await this.s3.headObject(params).promise();
    } catch (ex) {
      //file doesn't exist
      return undefined;
    }

    //Expires in 3 hours
    return this.s3.getSignedUrlPromise('getObject', { ...params, Expires: 3 * 60 * 60 });
  }

  async getUploadUrl(urlParams: StorageUrlParams): Promise<string> {
    const { storageType, memberId, id } = urlParams;
    const params = { Bucket: this.bucket, Key: `public/${storageType}/${memberId}/${id}` };

    //expires in 30 minutes
    return this.s3.getSignedUrlPromise('putObject', { ...params, Expires: 0.5 * 60 * 60 });
  }
}
