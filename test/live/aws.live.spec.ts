import * as AWS from 'aws-sdk';
import axios from 'axios';
import * as config from 'config';
import * as faker from 'faker';
import { Platform, StorageType } from '../../src/common';
import { ConfigsService, StorageService } from '../../src/providers';
import { mockGenerateMember, mockGenerateUser } from '../generators';

describe('live: aws', () => {
  describe('storage', () => {
    let storageService: StorageService;
    const bucketName = config.get('storage');
    const member = mockGenerateMember();
    member.id = `test-member-${new Date().getTime()}`;
    const s3 = new AWS.S3({ signatureVersion: 'v4', apiVersion: '2006-03-01' });

    beforeAll(async () => {
      const configService = new ConfigsService();
      storageService = new StorageService(configService);
      await storageService.onModuleInit();

      const user = mockGenerateUser();
      await storageService.handleNewMember({ member, user, platform: Platform.android });
    });

    afterAll(async () => {
      await Promise.all(
        Object.values(StorageType).map(async (type) => {
          await emptyDir(`public/${type}/${member.id}`);
        }),
      );
    });

    //TODO values
    //TODO values
    //TODO values
    //TODO values
    test.each(Object.values(StorageType))(
      `should upload+download a %p file from aws storage`,
      async (storageType) => {
        const params = { memberId: member.id, storageType, id: `${faker.lorem.word()}.mp4` };
        const uploadUrl = await storageService.getUploadUrl(params);

        expect(uploadUrl).toMatch(
          `${bucketName}.s3.amazonaws.com/public/${storageType}/${params.memberId}/${params.id}`,
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
          `${bucketName}.s3.amazonaws.com/public/${storageType}/${member.id}/${params.id}`,
        );
        expect(url).toMatch(`X-Amz-Algorithm=AWS4-HMAC-SHA256`); //v4 signature
        expect(url).toMatch(`Amz-Expires=10800`); //expiration: 3 hours

        const { status: statusDownload } = await axios.get(url);
        expect(statusDownload).toEqual(200);
      },
    );

    async function emptyDir(dir: string) {
      const listParams = { Bucket: bucketName, Prefix: dir };

      const listedObjects = await s3.listObjectsV2(listParams).promise();
      if (listedObjects.Contents.length === 0) {
        return;
      }

      const deleteParams = { Bucket: bucketName, Delete: { Objects: [] } };

      listedObjects.Contents.forEach(({ Key }) => {
        deleteParams.Delete.Objects.push({ Key });
      });
      await s3.deleteObjects(deleteParams).promise();

      if (listedObjects.IsTruncated) {
        await emptyDir(dir);
      }
    }
  });
});
