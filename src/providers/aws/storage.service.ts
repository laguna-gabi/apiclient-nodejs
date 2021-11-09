import { Injectable, OnModuleInit } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import * as AWS from 'aws-sdk';
import { ConfigsService, ExternalConfigs } from '.';
import { EventType, IEventNewMember, Logger, StorageType, StorageUrlParams } from '../../common';

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly s3 = new AWS.S3({ signatureVersion: 'v4', apiVersion: '2006-03-01' });
  private bucket: string;

  constructor(readonly logger: Logger, private readonly configsService: ConfigsService) {}

  async onModuleInit(): Promise<void> {
    this.bucket = await this.configsService.getConfig(ExternalConfigs.aws.memberBucketName);
  }

  @OnEvent(EventType.newMember, { async: true })
  async handleNewMember(params: IEventNewMember) {
    this.logger.debug(params, StorageService.name, this.handleNewMember.name);
    const { id } = params.member;
    try {
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
    } catch (ex) {
      this.logger.error(params, StorageService.name, this.handleNewMember.name, ex);
    }
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

  async deleteMember(id: string) {
    this.logger.debug(id, StorageService.name, this.deleteMember.name);
    try {
      await Promise.all(
        Object.values(StorageType).map(async (type) => {
          await this.emptyDirectory(`public/${type}/${id}/`);
        }),
      );
    } catch (ex) {
      this.logger.error(id, StorageService.name, this.deleteMember.name, ex);
    }
  }

  async deleteRecordings(memberId: string, recordingIds: string[]) {
    this.logger.debug({ memberId, recordingIds }, StorageService.name, this.deleteRecordings.name);
    try {
      const deleteParams = {
        Bucket: this.bucket,
        Delete: {
          Objects: recordingIds.map((recordingId) => ({
            Key: `public/${StorageType.recordings}/${memberId}/${recordingId}`,
          })),
        },
      };
      await this.s3.deleteObjects(deleteParams).promise();
    } catch (ex) {
      this.logger.error(
        { memberId, recordingIds },
        StorageService.name,
        this.deleteRecordings.name,
        ex,
      );
    }
  }

  private async emptyDirectory(dir) {
    const listParams = {
      Bucket: this.bucket,
      Prefix: dir,
    };
    const listedObjects = await this.s3.listObjectsV2(listParams).promise();

    if (listedObjects.Contents.length === 0) return;

    const deleteParams = {
      Bucket: this.bucket,
      Delete: { Objects: [] },
    };
    listedObjects.Contents.forEach(({ Key }) => {
      deleteParams.Delete.Objects.push({ Key });
    });
    await this.s3.deleteObjects(deleteParams).promise();

    if (listedObjects.IsTruncated) {
      await this.emptyDirectory(dir);
    }
  }
}
