export enum ErrorType {
  notificationNotFound = 8100,

  invalidPhoneNumberForMessaging = 8802,
}

export const Errors: Map<ErrorType, string> = new Map([
  [ErrorType.notificationNotFound.valueOf(), `notification not found`],
  [
    ErrorType.invalidPhoneNumberForMessaging.valueOf(),
    'invalid phone or landline - can not send SMS',
  ],
]);
