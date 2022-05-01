export enum EventType {
  onTranscriptTranscribed = 'onTranscriptTranscribed',
  onTranscriptFailed = 'onTranscriptFailed',
}

export interface IEventOnTranscriptTranscribed {
  transcriptionId: string;
}

export interface IEventOnTranscriptFailed extends IEventOnTranscriptTranscribed {
  failureReason: string;
}
