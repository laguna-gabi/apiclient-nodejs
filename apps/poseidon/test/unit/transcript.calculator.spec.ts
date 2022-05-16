import { mockProcessWarnings } from '@argus/pandora';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { generateId } from '..';
import { DbModule } from '../../src/db';
import { RevAI } from '../../src/providers';
import { TranscriptCalculator, TranscriptModule, TranscriptService } from '../../src/transcript';
import * as transcriptObjectMock from './mocks/transcriptObjectMock.json';

describe(TranscriptService.name, () => {
  let module: TestingModule;
  let transcriptCalculator: TranscriptCalculator;
  let revAI: RevAI;

  beforeAll(async () => {
    mockProcessWarnings(); // to hide pino prettyPrint warning
    module = await Test.createTestingModule({
      imports: [DbModule, EventEmitterModule.forRoot(), TranscriptModule],
    }).compile();

    transcriptCalculator = module.get<TranscriptCalculator>(TranscriptCalculator);
    revAI = module.get<RevAI>(RevAI);
  });

  describe('calculateConversationPercentage', () => {
    let spyOnRevAIGetTranscriptObject;

    beforeEach(() => {
      spyOnRevAIGetTranscriptObject = jest.spyOn(revAI, 'getTranscriptObject');
    });

    afterEach(() => {
      spyOnRevAIGetTranscriptObject.mockReset();
    });

    it('should calculate each speaker and silence percentage', async () => {
      const transcriptionId = generateId();
      spyOnRevAIGetTranscriptObject.mockImplementationOnce(async () => transcriptObjectMock);

      const result = await transcriptCalculator.calculateConversationPercentage(transcriptionId);

      expect(result).toEqual({ speakerA: 13, speakerB: 25, silence: 62 });
    });

    it('should return only silence', async () => {
      const transcriptionId = generateId();
      spyOnRevAIGetTranscriptObject.mockImplementationOnce(async () => {
        return {
          monologues: [],
        };
      });

      const result = await transcriptCalculator.calculateConversationPercentage(transcriptionId);

      expect(result).toEqual({ speakerA: 0, speakerB: 0, silence: 100 });
    });
  });
});
