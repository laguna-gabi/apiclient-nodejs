import { StorageType, mockLogger, mockProcessWarnings } from '@argus/pandora';
import {
  ConversationPercentage,
  Transcript,
  TranscriptDocument,
  TranscriptDto,
  TranscriptStatus,
} from '@argus/poseidonClient';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { lorem } from 'faker';
import { readFileSync } from 'fs';
import { Model, model } from 'mongoose';
import { dbConnect, generateId, generateTranscriptMock } from '..';
import { LoggerService } from '../../src/common';
import { DbModule } from '../../src/db';
import { RevAI, StorageService } from '../../src/providers';
import { TranscriptCalculator, TranscriptModule, TranscriptService } from '../../src/transcript';

describe(TranscriptService.name, () => {
  let module: TestingModule;
  let service: TranscriptService;
  let transcriptCalculator: TranscriptCalculator;
  let revAI: RevAI;
  let storageService: StorageService;
  let transcriptModel: Model<TranscriptDocument>;

  beforeAll(async () => {
    mockProcessWarnings(); // to hide pino prettyPrint warning
    module = await Test.createTestingModule({
      imports: [DbModule, EventEmitterModule.forRoot(), TranscriptModule],
    }).compile();

    service = module.get<TranscriptService>(TranscriptService);
    transcriptCalculator = module.get<TranscriptCalculator>(TranscriptCalculator);
    revAI = module.get<RevAI>(RevAI);
    storageService = module.get<StorageService>(StorageService);
    transcriptModel = model<TranscriptDocument>(Transcript.name, TranscriptDto);

    mockLogger(module.get<LoggerService>(LoggerService));

    await dbConnect();
  });

  afterAll(async () => {
    await module.close();
  });

  describe('get', () => {
    it('should return transcript if exists', async () => {
      const transcript = generateTranscriptMock();
      await transcriptModel.create(transcript);

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

  describe('handleTranscriptTranscribed', () => {
    let spyOnCalculatorCalculateConversationPercentage;
    let spyOnRevAIGetTranscriptText;
    let spyOnStorageUploadFile;

    beforeEach(() => {
      spyOnCalculatorCalculateConversationPercentage = jest.spyOn(
        transcriptCalculator,
        'calculateConversationPercentage',
      );
      spyOnRevAIGetTranscriptText = jest.spyOn(revAI, 'getTranscriptText');
      spyOnStorageUploadFile = jest.spyOn(storageService, 'uploadFile');
    });

    afterEach(() => {
      spyOnCalculatorCalculateConversationPercentage.mockReset();
      spyOnRevAIGetTranscriptText.mockReset();
      spyOnStorageUploadFile.mockReset();
    });

    it('should handel transcript transcribed', async () => {
      const transcriptText = readFileSync(
        'apps/poseidon/test/unit/mocks/transcriptTextMock.txt',
      ).toString();
      const conversationPercentage: ConversationPercentage = {
        speakerA: 40,
        speakerB: 40,
        silence: 20,
      };
      spyOnRevAIGetTranscriptText.mockImplementationOnce(async () => transcriptText);
      spyOnCalculatorCalculateConversationPercentage.mockImplementationOnce(
        async () => conversationPercentage,
      );
      spyOnStorageUploadFile.mockImplementation();
      const { recordingId, memberId, transcriptionId } = await createTranscript();

      await service.handleTranscriptTranscribed({ transcriptionId });

      expect(spyOnStorageUploadFile).toHaveBeenCalledTimes(2);
      expect(spyOnStorageUploadFile).toHaveBeenNthCalledWith(1, {
        storageType: StorageType.transcripts,
        memberId,
        id: recordingId,
        data: transcriptText,
      });
      expect(spyOnStorageUploadFile).toHaveBeenNthCalledWith(2, {
        storageType: StorageType.transcripts,
        memberId,
        id: `${recordingId}.json`,
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        data: service.createTranscriptJson(transcriptText),
      });

      const updatedTranscript = await transcriptModel.findOne({ transcriptionId });
      expect(updatedTranscript).toEqual(
        expect.objectContaining({
          recordingId,
          memberId,
          transcriptionId,
          status: TranscriptStatus.done,
          conversationPercentage,
        }),
      );
    });

    test.each`
      time          | seconds
      ${'00:00:00'} | ${0}
      ${'00:01:01'} | ${61}
      ${'12:45:07'} | ${45907}
    `('should get seconds from Time', ({ time, seconds }) => {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const result = service.getSecondsFromTime(time);
      expect(result).toEqual(seconds);
    });
  });

  describe('handleTranscriptFailed', () => {
    it('should handel transcript failed', async () => {
      const failureReason = lorem.words();
      const { recordingId, memberId, transcriptionId } = await createTranscript();

      await service.handleTranscriptFailed({ failureReason, transcriptionId });

      const updatedTranscript = await transcriptModel.findOne({ transcriptionId });
      expect(updatedTranscript).toEqual(
        expect.objectContaining({
          recordingId,
          memberId,
          transcriptionId,
          status: TranscriptStatus.error,
          failureReason,
        }),
      );
    });
  });

  async function createTranscript({
    recordingId = generateId(),
    memberId = generateId(),
    transcriptionId = generateId(),
  }: {
    recordingId?: string;
    memberId?: string;
    transcriptionId?: string;
  } = {}) {
    await transcriptModel.create({ recordingId, memberId, transcriptionId });
    return { recordingId, memberId, transcriptionId };
  }
});
