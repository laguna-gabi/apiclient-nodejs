import * as config from 'config';

const graphqlConfig = config.get('graphql.validators.name');

export const validPhoneNumbersExamples =
  'examples for a valid phone number: +41 311111111, +41 (0)31 633 60 01, +49 9072 1111, etc..';

export enum ErrorType {
  // Module user errors
  userMinMaxLength = 9101,
  userEmailAlreadyExists = 9102,
  userEmailFormat = 9103,
  userAvatarFormat = 9104,

  // Module member errors
  memberMinMaxLength = 9201,
  memberPhoneAlreadyExists = 9202,
  memberPhoneNumber = 9203,
  memberDateOfBirth = 9204,
  memberDischargeDate = 9205,
  memberEmailFormat = 9206,

  // Module appointment errors
  appointmentIdNotFound = 9301,
  appointmentNotBeforeDate = 9302,
  appointmentNotBeforeDateInThePast = 9303,
  appointmentStartDate = 9304,
  appointmentEndDate = 9305,
  appointmentEndAfterStart = 9306,
  appointmentNoShow = 9307,

  // Module org errors
  orgAlreadyExists = 9401,
  orgTrialDurationOutOfRange = 9402,
}

const nameFormat = `name must be between ${graphqlConfig.get('minLength')} and ${graphqlConfig.get(
  'maxLength',
)} characters`;
const dateInstanceFormat = 'must be a Date instance';
const emailFormat =
  'email must be in an email format - having a @ and an extension, for example: test@gmail.com';

export const Errors: Map<ErrorType, string> = new Map([
  [ErrorType.userMinMaxLength.valueOf(), `user ${nameFormat}`],
  [ErrorType.userEmailAlreadyExists.valueOf(), 'email already exists'],
  [ErrorType.userEmailFormat.valueOf(), emailFormat],
  [
    ErrorType.userAvatarFormat.valueOf(),
    'avatar must be an URL address, for example: www.google.com',
  ],
  [ErrorType.memberMinMaxLength.valueOf(), `member ${nameFormat}`],
  [ErrorType.memberPhoneAlreadyExists.valueOf(), 'phone already exists'],
  [
    ErrorType.memberPhoneNumber.valueOf(),
    `phone number must be a valid phone number. ` +
      `please make sure you've added the country code with (+) in the beginning. ` +
      `${validPhoneNumbersExamples}`,
  ],
  [ErrorType.memberDateOfBirth.valueOf(), `dateOfBirth ${dateInstanceFormat}`],
  [ErrorType.memberDischargeDate.valueOf(), `dischargeDate ${dateInstanceFormat}`],
  [ErrorType.memberEmailFormat.valueOf(), emailFormat],
  [ErrorType.appointmentIdNotFound.valueOf(), 'appointment id was not found'],
  [ErrorType.appointmentNotBeforeDate.valueOf(), `notBefore ${dateInstanceFormat}`],
  [ErrorType.appointmentNotBeforeDateInThePast.valueOf(), 'notBefore must be in the future'],
  [ErrorType.appointmentStartDate.valueOf(), `start ${dateInstanceFormat}`],
  [ErrorType.appointmentEndDate.valueOf(), `end ${dateInstanceFormat}`],
  [ErrorType.appointmentEndAfterStart.valueOf(), 'end date must be after start date'],
  [
    ErrorType.appointmentNoShow.valueOf(),
    'if noShow=true, a `reason` field is mandatory as well. ' +
      'if noShow=false, a `reason` field is not required',
  ],
  [ErrorType.orgAlreadyExists.valueOf(), 'organization already exists'],
  [ErrorType.orgTrialDurationOutOfRange.valueOf(), 'trialDuration must not be less than 1'],
]);

export const DbErrors = {
  duplicateKey: 11000,
};
