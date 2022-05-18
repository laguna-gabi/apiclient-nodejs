export enum ErrorType {
  // Notifications
  notificationNotFound = 8100,

  // Clients
  recipientClientNotFound = 8200,

  // Triggers
  triggeredIdNotFound = 8300,
  triggersAtPast = 8301,

  // dispatches
  dispatchNotFound = 8400,

  // Providers
  invalidPhoneNumberForMessaging = 8802,
}

export const Errors: Map<ErrorType, string> = new Map([
  [ErrorType.notificationNotFound.valueOf(), `notification not found`],
  [ErrorType.recipientClientNotFound.valueOf(), `recipientClient not found`],
  [ErrorType.triggeredIdNotFound.valueOf(), `triggeredId not found`],
  [ErrorType.dispatchNotFound.valueOf(), `dispatch not found`],
  [ErrorType.triggersAtPast.valueOf(), `triggersAt is in the past`],
  [
    ErrorType.invalidPhoneNumberForMessaging.valueOf(),
    'invalid phone or landline - can not send SMS',
  ],
]);
