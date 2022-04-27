import { ServiceName } from '@argus/pandora';
import { v4 } from 'uuid';
import { ICreateTranscript, InnerQueueTypes } from '../interfaces';

export type CreateTranscriptType = ICreateTranscript;

export class ObjectCreateTranscriptClass {
  constructor(readonly objectCreateTranscript: CreateTranscriptType) {}
}

export const generateCreateTranscriptMock = ({
  recordingId,
  memberId,
  userId,
}: {
  recordingId: string;
  memberId: string;
  userId: string;
}): ICreateTranscript => {
  return {
    type: InnerQueueTypes.createTranscript,
    serviceName: ServiceName.hepius,
    correlationId: v4(),
    recordingId,
    memberId,
    userId,
  };
};
