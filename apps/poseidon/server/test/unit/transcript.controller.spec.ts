import { StorageType, generateId, mockLogger, mockProcessWarnings } from '@argus/pandora';
import { Speaker } from '@argus/poseidonClient';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { lorem } from 'faker';
import { dbConnect, dbDisconnect, generateTranscriptMock } from '..';
import { ErrorType, Errors, LoggerService } from '../../src/common';
import { DbModule } from '../../src/db';
import { StorageService } from '../../src/providers';
import { TranscriptController, TranscriptModule, TranscriptService } from '../../src/transcript';

describe('TranscriptController', () => {
  let module: TestingModule;
  let controller: TranscriptController;
  let transcriptService: TranscriptService;
  let storageService: StorageService;
  let logger: LoggerService;

  beforeAll(async () => {
    mockProcessWarnings(); // to hide pino prettyPrint warning
    module = await Test.createTestingModule({
      imports: [DbModule, EventEmitterModule.forRoot(), TranscriptModule],
    }).compile();

    controller = module.get<TranscriptController>(TranscriptController);
    transcriptService = module.get<TranscriptService>(TranscriptService);
    storageService = module.get<StorageService>(StorageService);
    logger = module.get<LoggerService>(LoggerService);
    mockLogger(logger);

    await dbConnect();
  });

  afterAll(async () => {
    await module.close();
    await dbDisconnect();
  });

  describe('getTranscript', () => {
    let spyOnTranscriptServiceGet;
    let spyOnStorageServiceGetDownloadUrl;
    let spyOnLoggerError;

    beforeEach(() => {
      spyOnTranscriptServiceGet = jest.spyOn(transcriptService, 'get');
      spyOnStorageServiceGetDownloadUrl = jest.spyOn(storageService, 'getDownloadUrl');
      spyOnLoggerError = jest.spyOn(logger, 'error');
    });

    afterEach(() => {
      spyOnTranscriptServiceGet.mockReset();
      spyOnStorageServiceGetDownloadUrl.mockReset();
    });

    it('should get transcript', async () => {
      const recordingId = generateId();
      const transcript = generateTranscriptMock({ recordingId });
      const transcriptLink = `www.${lorem.word}`;
      spyOnTranscriptServiceGet.mockImplementationOnce(async () => transcript);
      spyOnStorageServiceGetDownloadUrl.mockImplementationOnce(async () => transcriptLink);

      const result = await controller.getTranscript({ recordingId });

      expect(result).toEqual({ ...transcript, transcriptLink });
      expect(spyOnTranscriptServiceGet).toBeCalledWith(recordingId);
      expect(spyOnStorageServiceGetDownloadUrl).toBeCalledWith({
        storageType: StorageType.transcripts,
        memberId: transcript.memberId,
        id: `${recordingId}.json`,
      });
    });

    it('should return null if transcript does not exist', async () => {
      const recordingId = generateId();
      spyOnTranscriptServiceGet.mockImplementationOnce(async () => null);

      const result = await controller.getTranscript({ recordingId });

      expect(result).toBeUndefined();
      expect(spyOnTranscriptServiceGet).toBeCalledWith(recordingId);
      expect(spyOnStorageServiceGetDownloadUrl).not.toBeCalled();
      expect(spyOnLoggerError).toBeCalledWith(
        { recordingId },
        TranscriptController.name,
        controller.getTranscript.name,
        {
          message: Errors.get(ErrorType.transcriptNotFound),
        },
      );
    });
  });

  describe('setTranscriptSpeaker', () => {
    let spyOnTranscriptServiceSetSpeaker;
    let spyOnStorageServiceGetDownloadUrl;
    let spyOnLoggerError;

    beforeEach(() => {
      spyOnTranscriptServiceSetSpeaker = jest.spyOn(transcriptService, 'setSpeaker');
      spyOnStorageServiceGetDownloadUrl = jest.spyOn(storageService, 'getDownloadUrl');
      spyOnLoggerError = jest.spyOn(logger, 'error');
    });

    afterEach(() => {
      spyOnTranscriptServiceSetSpeaker.mockReset();
      spyOnStorageServiceGetDownloadUrl.mockReset();
    });

    test.each([Speaker.speakerA, Speaker.speakerB])(
      'should set speaker on transcript',
      async (coach) => {
        const recordingId = generateId();
        const transcript = generateTranscriptMock({ recordingId, coach });
        const transcriptLink = `www.${lorem.word}`;
        spyOnTranscriptServiceSetSpeaker.mockImplementationOnce(async () => transcript);
        spyOnStorageServiceGetDownloadUrl.mockImplementationOnce(async () => transcriptLink);

        const result = await controller.setTranscriptSpeaker({ recordingId, coach });

        expect(result).toEqual({ ...transcript, transcriptLink });
        expect(spyOnTranscriptServiceSetSpeaker).toBeCalledWith({ recordingId, coach });
        expect(spyOnStorageServiceGetDownloadUrl).toBeCalledWith({
          storageType: StorageType.transcripts,
          memberId: transcript.memberId,
          id: `${recordingId}.json`,
        });
      },
    );

    test.each([Speaker.speakerA, Speaker.speakerB])(
      'should return null if transcript does not exist',
      async (coach) => {
        const recordingId = generateId();
        spyOnTranscriptServiceSetSpeaker.mockImplementationOnce(async () => null);

        const result = await controller.setTranscriptSpeaker({ recordingId, coach });

        expect(result).toBeUndefined();
        expect(spyOnTranscriptServiceSetSpeaker).toBeCalledWith({ recordingId, coach });
        expect(spyOnStorageServiceGetDownloadUrl).not.toBeCalled();
        expect(spyOnLoggerError).toBeCalledWith(
          { recordingId },
          TranscriptController.name,
          controller.setTranscriptSpeaker.name,
          {
            message: Errors.get(ErrorType.transcriptNotFound),
          },
        );
      },
    );
  });
});
