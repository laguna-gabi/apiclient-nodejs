import { generateId } from '@argus/pandora';
import { Transcript, TranscriptStatus } from '@argus/poseidonClient';

export const generateTranscriptMock = ({
  recordingId = generateId(),
  memberId = generateId(),
  transcriptionId = generateId(),
}: Partial<Transcript> = {}): Transcript => {
  return { recordingId, memberId, transcriptionId, status: TranscriptStatus.done };
};
