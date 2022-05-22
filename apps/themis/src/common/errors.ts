export enum ErrorType {
  // State Resolver
  parentNotFound = 1100,
}

export const Errors: Map<ErrorType, string> = new Map([
  [ErrorType.parentNotFound.valueOf(), `parent not found`],
]);
