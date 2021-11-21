export enum ErrorType {
  notificationNotFound = 8100,
}

export const Errors: Map<ErrorType, string> = new Map([
  [ErrorType.notificationNotFound.valueOf(), `notification not found`],
]);
