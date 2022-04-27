import { ServiceName } from '@argus/pandora';
import { v4 } from 'uuid';
import { ICreateTranscript, InnerQueueTypes } from '../interfaces';

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
    serviceName: ServiceName.poseidon,
    correlationId: v4(),
    recordingId,
    memberId,
    userId,
  };
};
