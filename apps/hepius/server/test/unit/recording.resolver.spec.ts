import {
  StorageType,
  generateId,
  generateObjectId,
  mockLogger,
  mockProcessWarnings,
} from '@argus/pandora';
import { Test, TestingModule } from '@nestjs/testing';
import {
  dbDisconnect,
  defaultModules,
  generateCompleteMultipartUploadParams,
  generateMultipartUploadRecordingLinkParams,
  generateRecordingLinkParams,
  generateUniqueUrl,
  generateUpdateRecordingParams,
  mockGenerateRecording,
} from '..';
import { LoggerService } from '../../src/common';
import { JourneyService } from '../../src/journey';
import { StorageService } from '../../src/providers';
import { RecordingModule, RecordingResolver, RecordingService } from '../../src/recording';

describe('RecordingResolver', () => {
  let module: TestingModule;
  let resolver: RecordingResolver;
  let service: RecordingService;
  let storage: StorageService;
  let journeyService: JourneyService;

  beforeAll(async () => {
    mockProcessWarnings(); // to hide pino prettyPrint warning
    module = await Test.createTestingModule({
      imports: defaultModules().concat(RecordingModule),
    }).compile();

    resolver = module.get<RecordingResolver>(RecordingResolver);
    service = module.get<RecordingService>(RecordingService);
    storage = module.get<StorageService>(StorageService);
    journeyService = module.get<JourneyService>(JourneyService);
    mockLogger(module.get<LoggerService>(LoggerService));
  });

  afterAll(async () => {
    await module.close();
    await dbDisconnect();
  });

  describe('getMemberUploadRecordingLink', () => {
    let spyOnStorageUpload;

    beforeEach(() => {
      spyOnStorageUpload = jest.spyOn(storage, 'getUploadUrl');
    });

    afterEach(() => {
      spyOnStorageUpload.mockReset();
    });

    it('should get upload recording link', async () => {
      const recordingLinkParams = generateRecordingLinkParams();
      const uploadUrl = generateUniqueUrl();
      spyOnStorageUpload.mockImplementation(async () => uploadUrl);

      const result = await resolver.getMemberUploadRecordingLink(recordingLinkParams);

      expect(spyOnStorageUpload).toBeCalledWith({
        ...recordingLinkParams,
        storageType: StorageType.recordings,
      });
      expect(result).toEqual(uploadUrl);
    });
  });

  describe('getMemberMultipartUploadRecordingLink', () => {
    let spyOnStorageMultipartUploadUrl;

    beforeEach(() => {
      spyOnStorageMultipartUploadUrl = jest.spyOn(storage, 'getMultipartUploadUrl');
    });

    afterEach(() => {
      spyOnStorageMultipartUploadUrl.mockReset();
    });

    it('should get multipart upload recording link', async () => {
      const multipartUploadRecordingLinkParams = generateMultipartUploadRecordingLinkParams();
      const uploadUrl = generateUniqueUrl();
      spyOnStorageMultipartUploadUrl.mockImplementation(async () => {
        return { uploadId: multipartUploadRecordingLinkParams.uploadId, uploadUrl };
      });

      const result = await resolver.getMemberMultipartUploadRecordingLink(
        multipartUploadRecordingLinkParams,
      );

      expect(spyOnStorageMultipartUploadUrl).toBeCalledWith({
        ...multipartUploadRecordingLinkParams,
        storageType: StorageType.recordings,
      });
      expect(result).toEqual({ uploadId: multipartUploadRecordingLinkParams.uploadId, uploadUrl });
    });
  });

  describe('completeMultipartUpload', () => {
    let spyOnStorageCompleteMultipartUpload;

    beforeEach(() => {
      spyOnStorageCompleteMultipartUpload = jest.spyOn(storage, 'completeMultipartUpload');
    });

    afterEach(() => {
      spyOnStorageCompleteMultipartUpload.mockReset();
    });

    it('should complete multipart recording upload', async () => {
      const completeMultipartUploadParams = generateCompleteMultipartUploadParams();
      spyOnStorageCompleteMultipartUpload.mockImplementation(async () => true);

      const result = await resolver.completeMultipartUpload(completeMultipartUploadParams);

      expect(spyOnStorageCompleteMultipartUpload).toBeCalledWith({
        ...completeMultipartUploadParams,
        storageType: StorageType.recordings,
      });
      expect(result).toBeTruthy();
    });
  });

  describe('getMemberDownloadRecordingLink', () => {
    let spyOnStorageGetDownloadUrl;

    beforeEach(() => {
      spyOnStorageGetDownloadUrl = jest.spyOn(storage, 'getDownloadUrl');
    });

    afterEach(() => {
      spyOnStorageGetDownloadUrl.mockReset();
    });

    it('should get download recording link', async () => {
      const recordingLinkParams = generateRecordingLinkParams();
      const uploadUrl = generateUniqueUrl();
      spyOnStorageGetDownloadUrl.mockImplementation(async () => uploadUrl);

      const result = await resolver.getMemberDownloadRecordingLink(recordingLinkParams);

      expect(spyOnStorageGetDownloadUrl).toBeCalledWith({
        ...recordingLinkParams,
        storageType: StorageType.recordings,
      });
      expect(result).toEqual(uploadUrl);
    });
  });

  describe('updateRecording', () => {
    let spyOnJourneyServiceGetRecent;
    let spyOnServiceUpdate;

    beforeEach(() => {
      spyOnJourneyServiceGetRecent = jest.spyOn(journeyService, 'getRecent');
      spyOnServiceUpdate = jest.spyOn(service, 'updateRecording');
    });

    afterEach(() => {
      spyOnJourneyServiceGetRecent.mockReset();
      spyOnServiceUpdate.mockReset();
    });

    it('should update recording', async () => {
      const userId = generateId();
      const updateRecordingParams = generateUpdateRecordingParams({ userId });
      const journeyId = generateId();
      const recording = mockGenerateRecording({ journeyId: generateObjectId(journeyId) });
      spyOnServiceUpdate.mockImplementation(async () => recording);
      spyOnJourneyServiceGetRecent.mockResolvedValue({ id: journeyId });

      const result = await resolver.updateRecording(updateRecordingParams, userId);

      expect(spyOnJourneyServiceGetRecent).toBeCalledTimes(1);
      expect(spyOnJourneyServiceGetRecent).toHaveBeenCalledWith(updateRecordingParams.memberId);
      expect(spyOnServiceUpdate).toBeCalledWith({ ...updateRecordingParams, userId, journeyId });
      expect(result).toEqual(recording);
    });
  });

  describe('getRecordings', () => {
    let spyOnJourneyServiceGetRecent;
    let spyOnServiceGetRecordings;

    beforeEach(() => {
      spyOnJourneyServiceGetRecent = jest.spyOn(journeyService, 'getRecent');
      spyOnServiceGetRecordings = jest.spyOn(service, 'getRecordings');
    });

    afterEach(() => {
      spyOnJourneyServiceGetRecent.mockReset();
      spyOnServiceGetRecordings.mockReset();
    });

    it('should get recordings', async () => {
      const memberId = generateId();
      const userId = generateId();
      const journeyId = generateId();
      const recordings = [
        mockGenerateRecording({
          memberId: generateObjectId(memberId),
          userId: generateObjectId(userId),
          journeyId: generateObjectId(journeyId),
        }),
        mockGenerateRecording({
          memberId: generateObjectId(memberId),
          userId: generateObjectId(userId),
          journeyId: generateObjectId(journeyId),
        }),
      ];
      spyOnJourneyServiceGetRecent.mockResolvedValue({ id: journeyId });
      spyOnServiceGetRecordings.mockImplementation(async () => recordings);

      const result = await resolver.getRecordings(memberId);

      expect(spyOnJourneyServiceGetRecent).toBeCalledTimes(1);
      expect(spyOnJourneyServiceGetRecent).toHaveBeenCalledWith(memberId);
      expect(spyOnServiceGetRecordings).toBeCalledWith({ memberId, journeyId });
      expect(result).toEqual(recordings);
    });
  });
});
