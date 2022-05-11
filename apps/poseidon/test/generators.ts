import { Transcript, TranscriptStatus } from '@argus/poseidonClient';
import { Types } from 'mongoose';

export const generateObjectId = (id?): Types.ObjectId => {
  return new Types.ObjectId(id);
};

export const generateId = (id?): string => {
  return generateObjectId(id).toString();
};

export const generateTranscriptMock = ({
  recordingId = generateId(),
  memberId = generateId(),
  transcriptionId = generateId(),
}: Partial<Transcript> = {}): Transcript => {
  return { recordingId, memberId, transcriptionId, status: TranscriptStatus.done };
};
