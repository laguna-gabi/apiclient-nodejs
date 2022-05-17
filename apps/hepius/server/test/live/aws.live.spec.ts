import { Environments, Platform, StorageType, mockLogger } from '@argus/pandora';
import { S3 } from 'aws-sdk';
import axios from 'axios';
import { aws, hosts, services } from 'config';
import { createHash } from 'crypto';
import { EventEmitter2 } from 'eventemitter2';
import { lorem } from 'faker';
import { readFileSync, unlinkSync } from 'fs';
import { PARAMS_PROVIDER_TOKEN, Params } from 'nestjs-pino';
import { LoggerService } from '../../src/common';
import { CloudMapService, ConfigsService, StorageService } from '../../src/providers';
import { generateId, mockGenerateMember, mockGenerateUser } from '../generators';

describe('live: aws', () => {
  describe('storage', () => {
    let storageService: StorageService;
    let bucketName;
    let localStorage;
    const member = mockGenerateMember();
    member.id = `test-member-${new Date().getTime()}`;

    beforeAll(async () => {
      //not running on production as this test is too risky for that (we're emptyDir in afterAll)
      if (process.env.NODE_ENV === Environments.production) {
        return;
      }
      const configService = new ConfigsService();
      const eventEmitter = new EventEmitter2();
      const logger = new LoggerService(PARAMS_PROVIDER_TOKEN as Params, eventEmitter);
      mockLogger(logger);
      storageService = new StorageService(logger, configService);
      await storageService.onModuleInit();
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      bucketName = storageService.bucket;
      const user = mockGenerateUser();
      await storageService.handleNewMember({ member, user, platform: Platform.android });

      // create a local storage for testing
      localStorage = new S3({
        signatureVersion: 'v4',
        apiVersion: '2006-03-01',
        region: aws.region,
        endpoint: hosts.localstack,
        s3ForcePathStyle: true,
      });

      await localStorage
        .createBucket({
          Bucket: 'test-bucket',
        })
        .promise();
    });

    afterAll(async () => {
      //not running on production as this test is too risky for that (we're emptyDir in afterAll)
      if (process.env.NODE_ENV === Environments.production) {
        return;
      }
      await Promise.all(
        Object.values(StorageType).map(async (type) => {
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          await storageService.emptyDirectory(`public/${type}/${member.id}`);
        }),
      );
    });

    it('should be able to download a file', async () => {
      // upload a file to our local storage
      const filename = `lagunaIcon.png`;
      const fileContent = readFileSync(`./apps/hepius/server/test/live/mocks/${filename}`);

      const refHash = createHash('md5').update(fileContent.toString(), 'utf8').digest('hex');

      const params = {
        Bucket: `test-bucket`,
        Key: filename,
        Body: fileContent,
      };

      await localStorage.upload(params).promise();

      await storageService.downloadFile(`test-bucket`, filename, filename);

      expect(
        createHash('md5').update(readFileSync(filename).toString(), 'utf8').digest('hex'),
      ).toEqual(refHash);

      unlinkSync(filename);
    });

    test.each(Object.values(StorageType))(
      `should upload+download a %p file from aws storage`,
      async (storageType) => {
        //not running on production as this test is too risky for that (we're emptyDir in afterAll)
        if (process.env.NODE_ENV === Environments.production) {
          return;
        }

        const params = { memberId: member.id, storageType, id: `${lorem.word()}.mp4` };
        const uploadUrl = await storageService.getUploadUrl(params);

        expect(uploadUrl).toMatch(
          // eslint-disable-next-line max-len
          `${hosts.localstack}/${bucketName}/public/${storageType}/${params.memberId}/${params.id}`,
        );
        expect(uploadUrl).toMatch(`X-Amz-Algorithm=AWS4-HMAC-SHA256`); //v4 signature
        expect(uploadUrl).toMatch(`Amz-Expires=1800`); //expiration: 30 minutes

        const { status: uploadStatus } = await axios.put(uploadUrl, lorem.sentence());
        expect(uploadStatus).toEqual(200);

        const url = await storageService.getDownloadUrl({
          storageType,
          memberId: member.id,
          id: params.id,
        });

        expect(url).toMatch(
          `${hosts.localstack}/${bucketName}/public/${storageType}/${member.id}/${params.id}`,
        );
        expect(url).toMatch(`X-Amz-Algorithm=AWS4-HMAC-SHA256`); //v4 signature
        expect(url).toMatch(`Amz-Expires=10800`); //expiration: 3 hours

        const { status: statusDownload } = await axios.get(url);
        expect(statusDownload).toEqual(200);
      },
    );

    it('should get multipart upload, complete it and get a download link', async () => {
      //not running on production as this test is too risky for that (we're emptyDir in afterAll)
      if (process.env.NODE_ENV === Environments.production) {
        return;
      }
      const storageType = StorageType.recordings;
      const uploadPart = async (
        fileName: string,
        partNumber: number,
        data: string,
        id?: string,
      ) => {
        const params = {
          memberId: member.id,
          storageType,
          id: fileName,
          partNumber,
          uploadId: id,
        };
        const { url: uploadUrl, uploadId } = await storageService.getMultipartUploadUrl(params);
        expect(uploadUrl).toMatch(
          // eslint-disable-next-line max-len
          `${hosts.localstack}/${bucketName}/public/${storageType}/${params.memberId}/${params.id}`,
        );
        expect(uploadUrl).toMatch(`X-Amz-Algorithm=AWS4-HMAC-SHA256`); //v4 signature
        expect(uploadUrl).toMatch(`Amz-Expires=1800`); //expiration: 30 minutes

        const { status: uploadStatus } = await axios.put(uploadUrl, data, {
          maxBodyLength: Infinity,
        });
        expect(uploadStatus).toEqual(200);
        return uploadId;
      };

      const fileName = `${lorem.word()}.mp4`;
      const buffer = readFileSync('./apps/hepius/server/test/live/mocks/tempFile.ogg');

      const uploadID = await uploadPart(fileName, 0, buffer.toString('hex'));
      await uploadPart(fileName, 1, lorem.sentence(), uploadID);

      await storageService.completeMultipartUpload({
        uploadId: uploadID,
        memberId: member.id,
        id: fileName,
        storageType,
      });

      const url = await storageService.getDownloadUrl({
        storageType,
        memberId: member.id,
        id: fileName,
      });

      expect(url).toMatch(
        `${hosts.localstack}/${bucketName}/public/${storageType}/${member.id}/${fileName}`,
      );
      expect(url).toMatch(`X-Amz-Algorithm=AWS4-HMAC-SHA256`); //v4 signature
      expect(url).toMatch(`Amz-Expires=10800`); //expiration: 3 hours

      const { status: statusDownload } = await axios.get(url);
      expect(statusDownload).toEqual(200);
    });

    it('should move file to deleted folder', async () => {
      //not running on production as this test is too risky for that (we're emptyDir in afterAll)
      if (process.env.NODE_ENV === Environments.production) {
        return;
      }

      const storageType = StorageType.documents;
      const params = {
        memberId: member.id,
        storageType,
        id: `${lorem.word()}.pdf`,
      };
      const uploadUrl = await storageService.getUploadUrl(params);

      expect(uploadUrl).toMatch(
        // eslint-disable-next-line max-len
        `${hosts.localstack}/${bucketName}/public/${storageType}/${params.memberId}/${params.id}`,
      );

      const { status: uploadStatus } = await axios.put(uploadUrl, lorem.sentence());
      expect(uploadStatus).toEqual(200);

      const existingFile = await storageService.getDownloadUrl({
        storageType,
        memberId: member.id,
        id: params.id,
      });
      expect(existingFile).not.toBeUndefined();

      await storageService.moveToDeleted({
        storageType,
        memberId: member.id,
        id: params.id,
      });

      const nonExistingFile = await storageService.getDownloadUrl({
        storageType,
        memberId: member.id,
        id: params.id,
      });
      expect(nonExistingFile).toBeUndefined();
    });

    it('should return true if document already exists', async () => {
      //not running on production as this test is too risky for that (we're emptyDir in afterAll)
      if (process.env.NODE_ENV === Environments.production) {
        return;
      }

      const fileName = lorem.word();
      const storageType = StorageType.general;

      const resultBefore = await storageService.doesDocumentAlreadyExists({
        memberId: member.id,
        storageType,
        id: fileName,
      });
      expect(resultBefore).toBeFalsy();

      const params = {
        memberId: member.id,
        storageType,
        id: fileName,
      };
      const uploadUrl = await storageService.getUploadUrl(params);

      expect(uploadUrl).toMatch(
        // eslint-disable-next-line max-len
        `${hosts.localstack}/${bucketName}/public/${storageType}/${params.memberId}/${params.id}`,
      );

      const { status: uploadStatus } = await axios.put(uploadUrl, lorem.sentence());
      expect(uploadStatus).toEqual(200);

      const resultAfter = await storageService.doesDocumentAlreadyExists({
        memberId: member.id,
        storageType,
        id: fileName,
      });
      expect(resultAfter).toBeTruthy();
    });

    it('should return list of files for a given folder', async () => {
      //not running on production as this test is too risky for that (we're emptyDir in afterAll)
      if (process.env.NODE_ENV === Environments.production) {
        return;
      }

      const memberId = generateId();
      const storageType = StorageType.general;
      const files = [lorem.word(), lorem.word(), lorem.word()];

      // simulate `handleNewMember` create member folder object
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const params = { Bucket: storageService.bucket, Key: `public/${storageType}/${memberId}/` };
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      await storageService.s3.putObject(params).promise();

      const resultBefore = await storageService.getFolderFiles({
        storageType,
        memberId,
      });
      expect(resultBefore.length).toEqual(0);

      await Promise.all(
        files.map(async (file) => {
          const params = {
            memberId,
            storageType,
            id: file,
          };
          const uploadUrl = await storageService.getUploadUrl(params);
          await axios.put(uploadUrl, lorem.sentence());
        }),
      );

      const resultAfter = await storageService.getFolderFiles({
        storageType,
        memberId,
      });
      expect(resultAfter.length).toEqual(files.length);
      expect(resultAfter).toEqual(expect.arrayContaining(files));
    });

    it('should delete file', async () => {
      //not running on production as this test is too risky for that (we're emptyDir in afterAll)
      if (process.env.NODE_ENV === Environments.production) {
        return;
      }

      const memberId = generateId();
      const storageType = StorageType.general;
      const fileName = lorem.word();

      // simulate `handleNewMember` create member folder object
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const params = { Bucket: storageService.bucket, Key: `public/${storageType}/${memberId}/` };
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      await storageService.s3.putObject(params).promise();

      const uploadParams = {
        memberId,
        storageType,
        id: fileName,
      };
      const uploadUrl = await storageService.getUploadUrl(uploadParams);
      await axios.put(uploadUrl, lorem.sentence());

      const resultBefore = await storageService.getFolderFiles({
        storageType,
        memberId,
      });
      expect(resultBefore.length).toEqual(1);
      expect(resultBefore).toEqual(expect.arrayContaining([fileName]));

      await storageService.deleteFile({
        storageType,
        memberId,
        id: fileName,
      });

      const resultAfter = await storageService.getFolderFiles({
        storageType,
        memberId,
      });
      expect(resultAfter.length).toEqual(0);
    });
  });

  describe('cloudMap', () => {
    let cloudMapService: CloudMapService;

    beforeAll(async () => {
      const logger = new LoggerService(PARAMS_PROVIDER_TOKEN as Params, new EventEmitter2());
      mockLogger(logger);
      cloudMapService = new CloudMapService(logger);
    });

    it('should be able to find a service by name', async () => {
      const service = await cloudMapService.discoverInstance(services.iris.taskName);
      expect(service).toBeTruthy();
    });

    it('should throw an exception id service is not found', async () => {
      await expect(
        cloudMapService.discoverInstance(services.iris.taskName + `+invalid`),
      ).rejects.toThrow(
        new Error(`could not find instance ${services.iris.taskName + `+invalid`}`),
      );
    });
  });
});
