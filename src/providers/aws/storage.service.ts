import { Injectable, OnModuleInit } from '@nestjs/common';
import * as AWS from 'aws-sdk';
import { ConfigsService, environments, ExternalConfigs } from '.';
import { StorageUrlParams, EventType, IEventNewMember, StorageType } from '../../common';
import { OnEvent } from '@nestjs/event-emitter';
import * as config from 'config';

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly s3 = new AWS.S3({ signatureVersion: 'v4', apiVersion: '2006-03-01' });
  private bucket: string;

  constructor(private readonly configsService: ConfigsService) {}

  async onModuleInit(): Promise<void> {
    this.bucket =
      !process.env.NODE_ENV || process.env.NODE_ENV === environments.test
        ? config.get('storage')
        : await this.configsService.getConfig(ExternalConfigs.aws.memberBucketName);
  }

  @OnEvent(EventType.newMember, { async: true })
  async handleNewMember(eventNewMember: IEventNewMember) {
    const { id } = eventNewMember.member;
    await Promise.all(
      Object.values(StorageType).map(async (type) => {
        const params = { Bucket: this.bucket, Key: `public/${type}/${id}/` };
        try {
          await this.s3.headObject(params).promise();
        } catch (ex) {
          await this.s3.putObject(params).promise();
        }
      }),
    );
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
