import { ServiceName } from '@argus/pandora';

export enum InnerQueueTypes {
  createTranscript = 'createTranscript',
}

export interface IInnerQueueTypes {
  type: InnerQueueTypes;
}

interface IDispatch extends IInnerQueueTypes {
  serviceName: ServiceName;
  correlationId: string;
}

export interface ICreateTranscript extends IDispatch {
  recordingId: string;
  memberId: string;
  userId: string;
}
