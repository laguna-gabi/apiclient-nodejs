import { Environments, Platform, mockLogger } from '@lagunahealth/pandora';
import axios from 'axios';
import * as config from 'config';
import { EventEmitter2 } from 'eventemitter2';
import * as faker from 'faker';
import { readFileSync } from 'fs';
import { PARAMS_PROVIDER_TOKEN, Params } from 'nestjs-pino';
import { LoggerService, StorageType } from '../../src/common';
import { AudioFormat, AudioType, ImageFormat, ImageType } from '../../src/member';
import { ConfigsService, StorageService } from '../../src/providers';
import { generateId, mockGenerateMember, mockGenerateUser } from '../generators';

describe('live: aws', () => {
  describe('storage', () => {
    let storageService: StorageService;
    let bucketName;
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

    it('should delete given recordings for a specific member', async () => {
      if (process.env.NODE_ENV === Environments.production) {
        return;
      }
      const getParams = (id: string) => ({
        memberId: member.id,
        storageType: StorageType.recordings,
        id,
      });
      const uploadFile = async (fileName: string) => {
        const uploadUrl = await storageService.getUploadUrl(getParams(fileName));
        expect(uploadUrl).toMatch(`X-Amz-Algorithm=AWS4-HMAC-SHA256`); //v4 signature
        expect(uploadUrl).toMatch(`Amz-Expires=1800`); //expiration: 30 minutes

        const { status: uploadStatus } = await axios.put(uploadUrl, faker.lorem.sentence());
        expect(uploadStatus).toEqual(200);
      };
      const files = [`${faker.lorem.word()}1.mp4`, `${faker.lorem.word()}2.mp4`];
      await Promise.all(files.map(uploadFile));
      const existingUrls = await Promise.all(
        files.map((file) => storageService.getDownloadUrl(getParams(file))),
      );
      expect(existingUrls[0]).toMatch(
        // eslint-disable-next-line max-len
        `${config.get('hosts.localstack')}/${bucketName}/public/${StorageType.recordings}/${
          member.id
        }/${files[0]}`,
      );
      expect(existingUrls[1]).toMatch(
        // eslint-disable-next-line max-len
        `${config.get('hosts.localstack')}/${bucketName}/public/${StorageType.recordings}/${
          member.id
        }/${files[1]}`,
      );
      await storageService.deleteRecordings(member.id, files);
      const nonExistingUrls = await Promise.all(
        files.map((file) => storageService.getDownloadUrl(getParams(file))),
      );
      expect(nonExistingUrls[0]).toBeUndefined();
      expect(nonExistingUrls[1]).toBeUndefined();
    });

    it('should delete given journal images for a specific member', async () => {
      if (process.env.NODE_ENV === Environments.production) {
        return;
      }
      const id = generateId();
      const fileContent = readFileSync('./test/live/mocks/lagunaIcon.png');
      const normalImageUploadParams = {
        Bucket: bucketName,
        // eslint-disable-next-line max-len
        Key: `public/${StorageType.journals}/${member.id}/${id}${ImageType.NormalImage}.${ImageFormat.png}`,
        Body: fileContent,
        ContentType: 'image',
      };
      const smallImageUploadParams = {
        Bucket: bucketName,
        // eslint-disable-next-line max-len
        Key: `public/${StorageType.journals}/${member.id}/${id}${ImageType.SmallImage}.${ImageFormat.png}`,
        Body: fileContent,
        ContentType: 'image',
      };
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      await storageService.s3.putObject(normalImageUploadParams).promise();
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      await storageService.s3.putObject(smallImageUploadParams).promise();

      const getParams = (id: string) => ({
        memberId: member.id,
        storageType: StorageType.journals,
        id,
      });

      const normalImageDownloadUrl = await storageService.getDownloadUrl(
        getParams(`${id}${ImageType.NormalImage}.${ImageFormat.png}`),
      );
      const smallImageDownloadUrl = await storageService.getDownloadUrl(
        getParams(`${id}${ImageType.SmallImage}.${ImageFormat.png}`),
      );

      expect(normalImageDownloadUrl).toMatch(
        // eslint-disable-next-line max-len
        `${config.get('hosts.localstack')}/${bucketName}/public/${StorageType.journals}/${
          member.id
        }/${id}${ImageType.NormalImage}.${ImageFormat.png}`,
      );
      expect(smallImageDownloadUrl).toMatch(
        // eslint-disable-next-line max-len
        `${config.get('hosts.localstack')}/${bucketName}/public/${StorageType.journals}/${
          member.id
        }/${id}${ImageType.SmallImage}.${ImageFormat.png}`,
      );
      await storageService.deleteJournalImages(id, member.id, ImageFormat.png);
      const nonExistingNormalImageDownloadUrl = await storageService.getDownloadUrl(
        getParams(`${id}${ImageType.NormalImage}.${ImageFormat.png}`),
      );
      const nonExistingSmallImageDownloadUrl = await storageService.getDownloadUrl(
        getParams(`${id}${ImageType.SmallImage}.${ImageFormat.png}`),
      );
      expect(nonExistingNormalImageDownloadUrl).toBeUndefined();
      expect(nonExistingSmallImageDownloadUrl).toBeUndefined();
    }, 10000);

    it('should delete given journal audio for a specific member', async () => {
      if (process.env.NODE_ENV === Environments.production) {
        return;
      }

      const journalId = generateId();
      const params = {
        memberId: member.id,
        storageType: StorageType.journals,
        id: `${journalId}${AudioType}.${AudioFormat.mp3}`,
      };
      const uploadUrl = await storageService.getUploadUrl(params);

      expect(uploadUrl).toMatch(
        // eslint-disable-next-line max-len
        `${config.get('hosts.localstack')}/${bucketName}/public/${StorageType.journals}/${
          params.memberId
        }/${params.id}`,
      );
      expect(uploadUrl).toMatch(`X-Amz-Algorithm=AWS4-HMAC-SHA256`); //v4 signature
      expect(uploadUrl).toMatch(`Amz-Expires=1800`); //expiration: 30 minutes

      const { status: uploadStatus } = await axios.put(uploadUrl, faker.lorem.sentence());
      expect(uploadStatus).toEqual(200);

      const url = await storageService.getDownloadUrl({
        storageType: StorageType.journals,
        memberId: member.id,
        id: params.id,
      });

      expect(url).toMatch(
        // eslint-disable-next-line max-len
        `${config.get('hosts.localstack')}/${bucketName}/public/${StorageType.journals}/${
          member.id
        }/${journalId}${AudioType}.${AudioFormat.mp3}`,
      );
      await storageService.deleteJournalAudio(journalId, member.id, AudioFormat.mp3);

      const nonExistingAudioDownloadUrl = await storageService.getDownloadUrl({
        storageType: StorageType.journals,
        memberId: member.id,
        id: params.id,
      });

      expect(nonExistingAudioDownloadUrl).toBeUndefined();
    });

    test.each(Object.values(StorageType))(
      `should upload+download a %p file from aws storage`,
      async (storageType) => {
        //not running on production as this test is too risky for that (we're emptyDir in afterAll)
        if (process.env.NODE_ENV === Environments.production) {
          return;
        }

        const params = { memberId: member.id, storageType, id: `${faker.lorem.word()}.mp4` };
        const uploadUrl = await storageService.getUploadUrl(params);

        expect(uploadUrl).toMatch(
          // eslint-disable-next-line max-len
          `${config.get('hosts.localstack')}/${bucketName}/public/${storageType}/${
            params.memberId
          }/${params.id}`,
        );
        expect(uploadUrl).toMatch(`X-Amz-Algorithm=AWS4-HMAC-SHA256`); //v4 signature
        expect(uploadUrl).toMatch(`Amz-Expires=1800`); //expiration: 30 minutes

        const { status: uploadStatus } = await axios.put(uploadUrl, faker.lorem.sentence());
        expect(uploadStatus).toEqual(200);

        const url = await storageService.getDownloadUrl({
          storageType,
          memberId: member.id,
          id: params.id,
        });

        expect(url).toMatch(
          `${config.get('hosts.localstack')}/${bucketName}/public/${storageType}/${member.id}/${
            params.id
          }`,
        );
        expect(url).toMatch(`X-Amz-Algorithm=AWS4-HMAC-SHA256`); //v4 signature
        expect(url).toMatch(`Amz-Expires=10800`); //expiration: 3 hours

        const { status: statusDownload } = await axios.get(url);
        expect(statusDownload).toEqual(200);
      },
    );
  });
});
