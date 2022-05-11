import { Environments, StorageType, mockLogger, mockProcessWarnings } from '@argus/pandora';
import { S3 } from 'aws-sdk';
import { aws, hosts } from 'config';
import { EventEmitter2 } from 'eventemitter2';
import { lorem } from 'faker';
import { PARAMS_PROVIDER_TOKEN, Params } from 'nestjs-pino';
import { EventType, LoggerService } from '../../src/common';
import { ConfigsService, QueueService, StorageService } from '../../src/providers';
import { generateId } from '../generators';
import * as s3NewRecordingEventMock from './mocks/s3NewRecordingEventMock.json';

describe('live: aws', () => {
  describe('storage', () => {
    let storageService: StorageService;
    let localStorage: S3;
    let bucketName;

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

      // create a local storage for testing
      localStorage = new S3({
        signatureVersion: 'v4',
        apiVersion: '2006-03-01',
        region: aws.region,
        endpoint: hosts.localstack,
        s3ForcePathStyle: true,
      });
    });

    it('should upload a file', async () => {
      const memberId = generateId();
      const filename = generateId();
      const fileContent = lorem.words();

      const params = {
        storageType: StorageType.transcripts,
        memberId,
        id: filename,
        data: fileContent,
      };

      await storageService.uploadFile(params);

      const result = await localStorage
        .getObject({
          Key: `public/${params.storageType}/${params.memberId}/${params.id}`,
          Bucket: bucketName,
        })
        .promise();

      expect(result.Body.toString()).toEqual(fileContent);
    });
  });

  describe('queue', () => {
    let queueService: QueueService;
    let configService: ConfigsService;
    let eventEmitter: EventEmitter2;
    let spyOnEventEmitter;
    let logger: LoggerService;

    beforeAll(async () => {
      eventEmitter = new EventEmitter2();
      spyOnEventEmitter = jest.spyOn(eventEmitter, 'emit');
      configService = new ConfigsService();
      logger = new LoggerService(PARAMS_PROVIDER_TOKEN as Params, eventEmitter);

      queueService = new QueueService(eventEmitter, configService, logger);

      mockProcessWarnings(); // to hide pino prettyPrint warning
    });

    it('should call event onCreateTranscript', async () => {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      await queueService.handleMessage({ Body: JSON.stringify(s3NewRecordingEventMock) });

      expect(spyOnEventEmitter).toBeCalledWith(EventType.onCreateTranscript, {
        memberId: '619cdf3c384c1100278e2d34',
        recordingId: 'CAe66babd4ed74159353d4fc9587bf47f9',
      });
    });
  });
});
