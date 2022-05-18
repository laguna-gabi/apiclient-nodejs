export enum EventType {
  onCreateTranscript = 'onCreateTranscript',
  onTranscriptTranscribed = 'onTranscriptTranscribed',
  onTranscriptFailed = 'onTranscriptFailed',
}

export interface IEventOnCreateTranscript {
  memberId: string;
  recordingId: string;
}

export interface IEventOnTranscriptTranscribed {
  transcriptionId: string;
}

export interface IEventOnTranscriptFailed extends IEventOnTranscriptTranscribed {
  failureReason: string;
}
