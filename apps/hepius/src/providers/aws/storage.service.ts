import { Injectable, OnModuleInit } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import * as AWS from 'aws-sdk';
import { aws, hosts } from 'config';
import * as sharp from 'sharp';
import { ConfigsService, ExternalConfigs } from '.';
import {
  CompleteMultipartUploadUrlParams,
  EventType,
  IEventOnNewMember,
  LoggerService,
  MultipartUploadUrlParams,
  StorageType,
  StorageUrlParams,
} from '../../common';
import { AudioFormat, AudioType, ImageFormat, ImageType } from '../../member/journal.dto';
import { Environments, formatEx } from '@argus/pandora';
import * as fs from 'fs';
@Injectable()
export class StorageService implements OnModuleInit {
  private readonly s3 = new AWS.S3({
    signatureVersion: 'v4',
    apiVersion: '2006-03-01',
    region: aws.region,
    ...(!process.env.NODE_ENV || process.env.NODE_ENV === Environments.test
      ? {
          endpoint: hosts.localstack,
          s3ForcePathStyle: true,
        }
      : {}),
  });
  private bucket: string;

  constructor(readonly logger: LoggerService, private readonly configsService: ConfigsService) {}

  async onModuleInit(): Promise<void> {
    this.bucket =
      !process.env.NODE_ENV || process.env.NODE_ENV === Environments.test
        ? aws.storage.bucket
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

  async getMultipartUploadUrl(
    urlParams: MultipartUploadUrlParams,
  ): Promise<{ uploadId: string; url: string }> {
    const { storageType, memberId, id, partNumber, uploadId } = urlParams;
    const params = { Bucket: this.bucket, Key: `public/${storageType}/${memberId}/${id}` };

    const UploadId = uploadId || (await this.s3.createMultipartUpload(params).promise()).UploadId;

    const url = await this.s3.getSignedUrlPromise('uploadPart', {
      ...params,
      Expires: 0.5 * 60 * 60,
      UploadId,
      PartNumber: partNumber + 1,
    });
    return { url, uploadId: UploadId };
  }

  async completeMultipartUpload({
    uploadId,
    memberId,
    id,
    storageType,
  }: CompleteMultipartUploadUrlParams): Promise<boolean> {
    const Bucket = this.bucket;
    const Key = `public/${storageType}/${memberId}/${id}`;
    const UploadId = uploadId;
    const listPartsParams: AWS.S3.Types.ListPartsRequest = {
      Bucket,
      Key,
      UploadId,
    };
    const partsList = await this.s3.listParts(listPartsParams).promise();
    const Parts = partsList.Parts.map((part) => ({ ETag: part.ETag, PartNumber: part.PartNumber }));

    const params: AWS.S3.Types.CompleteMultipartUploadRequest = {
      ...listPartsParams,
      MultipartUpload: {
        Parts,
      },
    };

    await this.s3.completeMultipartUpload(params).promise();
    return true;
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
      const originalImage = await this.s3.getObject(downloadParams).promise();

      // Use the sharp module to resize the image and save in a buffer.
      const buffer = await sharp(originalImage.Body).resize(aws.storage.thumbnailSize).toBuffer();

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

  async moveToDeleted(urlParams: StorageUrlParams) {
    this.logger.info(urlParams, StorageService.name, this.moveToDeleted.name);
    const { storageType, memberId, id } = urlParams;
    try {
      await this.s3
        .copyObject({
          Bucket: this.bucket,
          CopySource: `${this.bucket}/public/${storageType}/${memberId}/${id}`,
          Key: `public/${storageType}/${memberId}/deleted/${new Date().getTime()}_${id}`,
        })
        .promise();

      await this.s3
        .deleteObject({
          Bucket: this.bucket,
          Key: `public/${storageType}/${memberId}/${id}`,
        })
        .promise();
    } catch (ex) {
      this.logger.error(urlParams, StorageService.name, this.moveToDeleted.name, formatEx(ex));
    }
  }

  async downloadFile(bucketName: string, keyName: string, localDest: string) {
    const data = await this.s3
      .getObject({
        Bucket: bucketName,
        Key: keyName,
      })
      .promise();

    fs.writeFileSync(localDest, data.Body.toString());
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

  async doesDocumentAlreadyExists(urlParams: StorageUrlParams): Promise<boolean> {
    const { storageType, memberId, id } = urlParams;
    const params = { Bucket: this.bucket, Key: `public/${storageType}/${memberId}/${id}` };
    try {
      await this.s3.headObject(params).promise();
      return true;
    } catch (ex) {
      if (ex.name === 'NotFound') {
        return false;
      }
    }
  }

  async getFolderFiles({
    storageType,
    memberId,
  }: {
    storageType: StorageType;
    memberId: string;
  }): Promise<string[]> {
    const params = { Bucket: this.bucket, Prefix: `public/${storageType}/${memberId}/` };
    const { Contents } = await this.s3.listObjectsV2(params).promise();
    /** remove first key that has only the folder name. created in @handleNewMember **/
    Contents.shift();
    return Contents.map((content) => {
      const keyArray = content.Key.split('/');
      return keyArray[keyArray.length - 1];
    });
  }

  async deleteFile(urlParams: StorageUrlParams): Promise<boolean> {
    const { storageType, memberId, id } = urlParams;
    this.logger.info(urlParams, StorageService.name, this.deleteFile.name);
    try {
      const deleteParams = { Bucket: this.bucket, Key: `public/${storageType}/${memberId}/${id}` };
      await this.s3.deleteObject(deleteParams).promise();
      return true;
    } catch (ex) {
      this.logger.error(urlParams, StorageService.name, this.deleteFile.name, formatEx(ex));
    }
  }
}
