import { Injectable, OnModuleInit } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import * as AWS from 'aws-sdk';
import * as config from 'config';
import * as sharp from 'sharp';
import { ConfigsService, ExternalConfigs } from '.';
import { EventType, IEventOnNewMember, Logger, StorageType, StorageUrlParams } from '../../common';
import { ImageFormat, ImageType } from '../../member/journal.dto';

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly s3 = new AWS.S3({ signatureVersion: 'v4', apiVersion: '2006-03-01' });
  private bucket: string;

  constructor(readonly logger: Logger, private readonly configsService: ConfigsService) {}

  async onModuleInit(): Promise<void> {
    this.bucket = await this.configsService.getConfig(ExternalConfigs.aws.memberBucketName);
  }

  @OnEvent(EventType.onNewMember, { async: true })
  async handleNewMember(params: IEventOnNewMember) {
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

  async deleteJournalImages(id: string, memberId: string, imageFormat: ImageFormat) {
    this.logger.debug({ id, memberId }, StorageService.name, this.deleteJournalImages.name);
    try {
      const deleteParams = {
        Bucket: this.bucket,
        Delete: {
          Objects: [
            {
              // eslint-disable-next-line max-len
              Key: `public/${StorageType.journals}/${memberId}/${id}${ImageType.NormalImage}.${imageFormat}`,
            },
            {
              // eslint-disable-next-line max-len
              Key: `public/${StorageType.journals}/${memberId}/${id}${ImageType.SmallImage}.${imageFormat}`,
            },
          ],
        },
      };
      await this.s3.deleteObjects(deleteParams).promise();
      return true;
    } catch (ex) {
      this.logger.error({ id, memberId }, StorageService.name, this.deleteJournalImages.name, ex);
    }
  }

  async createJournalImageThumbnail(normalImageKey: string, smallImageKey: string) {
    this.logger.debug(
      { normalImageKey, smallImageKey },
      StorageService.name,
      this.createJournalImageThumbnail.name,
    );
    try {
      const downloadParams = {
        Bucket: this.bucket,
        Key: normalImageKey,
      };
      const originalImage = await this.s3.getObject(downloadParams).promise();

      // Use the sharp module to resize the image and save in a buffer.
      const buffer = await sharp(originalImage.Body)
        .resize(config.get('aws.storage.thumbnailSize'))
        .toBuffer();

      const uploadParams = {
        Bucket: this.bucket,
        Key: smallImageKey,
        Body: buffer,
        ContentType: 'image',
      };
      await this.s3.putObject(uploadParams).promise();
    } catch (ex) {
      this.logger.error(
        { normalImageKey, smallImageKey },
        StorageService.name,
        this.createJournalImageThumbnail.name,
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
