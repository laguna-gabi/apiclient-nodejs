import axios from 'axios';
import { EventEmitter2 } from 'eventemitter2';
import * as faker from 'faker';
import { Environments, Logger, Platform, StorageType } from '../../src/common';
import { ConfigsService, StorageService } from '../../src/providers';
import { mockGenerateMember, mockGenerateUser } from '../generators';

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
      const logger = new Logger(eventEmitter);
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
  });
});
