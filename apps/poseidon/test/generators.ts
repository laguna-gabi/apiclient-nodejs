import { Types } from 'mongoose';
import { Transcript } from '../src/transcript';

export const generateObjectId = (id?): Types.ObjectId => {
  return new Types.ObjectId(id);
};

export const generateId = (id?): string => {
  return generateObjectId(id).toString();
};

export const generateTranscriptMock = ({
  recordingId = generateId(),
  memberId = generateId(),
  userId = generateId(),
}: Partial<Transcript> = {}): Transcript => {
  return { recordingId, memberId, userId };
};
