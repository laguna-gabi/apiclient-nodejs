import { generateId } from '@argus/pandora';
import { Speaker, Transcript, TranscriptStatus } from '@argus/poseidonClient';

export const generateTranscriptMock = ({
  recordingId = generateId(),
  memberId = generateId(),
  transcriptionId = generateId(),
}: Partial<Transcript> = {}): Transcript => {
  return { recordingId, memberId, transcriptionId, status: TranscriptStatus.done };
};

export const mockGenerateTranscriptDocument = ({
  recordingId = generateId(),
  memberId = generateId(),
  transcriptionId = generateId(),
  status = TranscriptStatus.done,
  conversationPercentage = { speakerA: 30, speakerB: 50, silence: 20 },
  coach = Speaker.speakerA,
} = {}) => {
  return {
    recordingId,
    memberId,
    transcriptionId,
    status,
    conversationPercentage,
    coach,
  };
};
