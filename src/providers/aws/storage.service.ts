import { Injectable, OnModuleInit } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import * as AWS from 'aws-sdk';
import * as config from 'config';
import * as sharp from 'sharp';
import { ConfigsService, ExternalConfigs } from '.';
import {
  EventType,
  IEventOnNewMember,
  LoggerService,
  StorageType,
  StorageUrlParams,
} from '../../common';
import { AudioFormat, AudioType, ImageFormat, ImageType } from '../../member/journal.dto';
import { Environments, formatEx } from '@lagunahealth/pandora';

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly s3 = new AWS.S3({
    signatureVersion: 'v4',
    apiVersion: '2006-03-01',
    region: config.get('aws.region'),
    ...(!process.env.NODE_ENV || process.env.NODE_ENV === Environments.test
      ? {
          endpoint: config.get('hosts.localstack'),
          s3ForcePathStyle: true,
        }
      : {}),
  });
  private bucket: string;

  constructor(readonly logger: LoggerService, private readonly configsService: ConfigsService) {}

  async onModuleInit(): Promise<void> {
    this.bucket =
      !process.env.NODE_ENV || process.env.NODE_ENV === Environments.test
        ? config.get('aws.storage.bucket')
        : await this.configsService.getConfig(ExternalConfigs.aws.memberBucketName);
  }

  @OnEvent(EventType.onNewMember, { async: true })
  async handleNewMember(params: IEventOnNewMember) {
    this.logger.info(params, StorageService.name, this.handleNewMember.name);
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
      this.logger.error(params, StorageService.name, this.handleNewMember.name, formatEx(ex));
    }
  }
  // Description: get object head from S3
  async getDocumentLastModified(key: string): Promise<Date> {
    const params = { Bucket: this.bucket, Key: key };

    try {
      return await (
        await this.s3.headObject(params).promise()
      ).LastModified;
    } catch (ex) {
      return; // file doesn't exist
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
    this.logger.info(id, StorageService.name, this.deleteMember.name);
    try {
      await Promise.all(
        Object.values(StorageType).map(async (type) => {
          await this.emptyDirectory(`public/${type}/${id}/`);
        }),
      );
    } catch (ex) {
      this.logger.error(id, StorageService.name, this.deleteMember.name, formatEx(ex));
    }
  }

  async deleteRecordings(memberId: string, recordingIds: string[]) {
    this.logger.info({ memberId, recordingIds }, StorageService.name, this.deleteRecordings.name);
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
        formatEx(ex),
      );
    }
  }

  async deleteJournalImages(id: string, memberId: string, imageFormat: ImageFormat) {
    this.logger.info(
      { id, memberId, imageFormat },
      StorageService.name,
      this.deleteJournalImages.name,
    );
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
      this.logger.error(
        { id, memberId, imageFormat },
        StorageService.name,
        this.deleteJournalImages.name,
        formatEx(ex),
      );
    }
  }

  async deleteJournalAudio(id: string, memberId: string, audioFormat: AudioFormat) {
    this.logger.info(
      { id, memberId, audioFormat },
      StorageService.name,
      this.deleteJournalAudio.name,
    );
    try {
      const deleteParams = {
        Bucket: this.bucket,
        Delete: {
          Objects: [
            {
              // eslint-disable-next-line max-len
              Key: `public/${StorageType.journals}/${memberId}/${id}${AudioType}.${audioFormat}`,
            },
          ],
        },
      };
      await this.s3.deleteObjects(deleteParams).promise();
      return true;
    } catch (ex) {
      this.logger.error(
        { id, memberId, audioFormat },
        StorageService.name,
        this.deleteJournalAudio.name,
        formatEx(ex),
      );
    }
  }

  async createJournalImageThumbnail(normalImageKey: string, smallImageKey: string) {
    this.logger.info(
      { normalImageKey, smallImageKey },
      StorageService.name,
      this.createJournalImageThumbnail.name,
    );
    try {
      const downloadParams = {
        Bucket: this.bucket,
        Key: normalImageKey,
      };
      const originalImage: any = await this.s3.getObject(downloadParams).promise();

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
        formatEx(ex),
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
