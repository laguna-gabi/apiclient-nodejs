export enum ErrorType {
  transcriptNotFound = 'transcriptNotFound',
}

export const Errors: Map<ErrorType, string> = new Map([
  [ErrorType.transcriptNotFound, 'transcript not found'],
]);
