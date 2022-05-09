import { StorageType, mockProcessWarnings } from '@argus/pandora';
import {
  Transcript,
  TranscriptDocument,
  TranscriptDto,
  TranscriptStatus,
} from '@argus/poseidonClient';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { RevAI, StorageService } from '../../src/providers';
import { Model, model } from 'mongoose';
import { dbConnect, generateId, generateTranscriptMock } from '..';
import { DbModule } from '../../src/db';
import { TranscriptModule, TranscriptService } from '../../src/transcript';
import { lorem } from 'faker';

describe(TranscriptService.name, () => {
  let module: TestingModule;
  let service: TranscriptService;
  let revAI: RevAI;
  let storageService: StorageService;
  let transcriptModel: Model<TranscriptDocument>;

  beforeAll(async () => {
    mockProcessWarnings(); // to hide pino prettyPrint warning
    module = await Test.createTestingModule({
      imports: [DbModule, EventEmitterModule.forRoot(), TranscriptModule],
    }).compile();

    service = module.get<TranscriptService>(TranscriptService);
    revAI = module.get<RevAI>(RevAI);
    storageService = module.get<StorageService>(StorageService);
    transcriptModel = model<TranscriptDocument>(Transcript.name, TranscriptDto);

    await dbConnect();
  });

  afterAll(async () => {
    await module.close();
  });

  describe('update', () => {
    it('should create new transcript if does not exist', async () => {
      const transcript = generateTranscriptMock();

      const resultBefore = await transcriptModel.findOne({ recordingId: transcript.recordingId });
      expect(resultBefore).toBeNull();

      const result = await service.update(transcript);

      expect(result).toEqual(expect.objectContaining(transcript));
      const resultAfter = await transcriptModel.findOne({ recordingId: transcript.recordingId });
      expect(resultAfter).toEqual(expect.objectContaining(transcript));
    });

    it('should update and already exists transcript', async () => {
      const transcript = generateTranscriptMock();
      await service.update(transcript);

      const resultBefore = await transcriptModel.findOne({ recordingId: transcript.recordingId });
      expect(resultBefore).toEqual(expect.objectContaining(transcript));

      const updateParams = generateTranscriptMock({ recordingId: transcript.recordingId });
      const result = await service.update(updateParams);

      expect(result).toEqual(expect.objectContaining(updateParams));
      const resultAfter = await transcriptModel.findOne({ recordingId: transcript.recordingId });
      expect(resultAfter).toEqual(expect.objectContaining(updateParams));
    });
  });

  describe('get', () => {
    it('should return transcript if exists', async () => {
      const transcript = generateTranscriptMock();
      await service.update(transcript);

      const result = await service.get(transcript.recordingId);
      expect(result).toEqual(expect.objectContaining(transcript));
    });

    it('should return null if transcript does not exist', async () => {
      const result = await service.get(generateId());
      expect(result).toBeNull();
    });
  });

  describe('handelCreateTranscript', () => {
    let spyOnStorageServiceGetDownloadUrl;
    let spyOnRevAICreateTranscript;

    beforeEach(() => {
      spyOnStorageServiceGetDownloadUrl = jest.spyOn(storageService, 'getDownloadUrl');
      spyOnRevAICreateTranscript = jest.spyOn(revAI, 'createTranscript');
    });

    afterEach(() => {
      spyOnStorageServiceGetDownloadUrl.mockReset();
      spyOnRevAICreateTranscript.mockReset();
    });

    it('should create transcript', async () => {
      const memberId = generateId();
      const recordingId = generateId();
      const transcriptionId = generateId();
      const recordingDownloadLink = `http://${lorem.word}.com`;

      spyOnStorageServiceGetDownloadUrl.mockImplementationOnce(async () => recordingDownloadLink);
      spyOnRevAICreateTranscript.mockImplementationOnce(async () => transcriptionId);

      await service.handleCreateTranscript({ memberId, recordingId });
      expect(spyOnStorageServiceGetDownloadUrl).toBeCalledWith({
        storageType: StorageType.recordings,
        memberId,
        id: recordingId,
      });
      expect(spyOnRevAICreateTranscript).toBeCalledWith(recordingDownloadLink);

      const resultAfter = await transcriptModel.findOne({ recordingId });
      expect(resultAfter).toEqual(
        expect.objectContaining({
          memberId,
          recordingId,
          transcriptionId,
          status: TranscriptStatus.received,
        }),
      );
    });
  });
});
