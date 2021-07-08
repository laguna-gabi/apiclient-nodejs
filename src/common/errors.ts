import * as config from 'config';

const graphqlConfig = config.get('graphql.validators.name');

export const validPhoneNumbersExamples =
  'examples for a valid phone number: +41 311111111, +41 (0)31 633 60 01, +49 9072 1111, etc..';

export enum ErrorType {
  // Module user errors
  userMinMaxLength = 9101,
  userEmailAlreadyExists = 9102,
  userEmailFormat = 9103,
  userPhotoUrlFormat = 9104,

  // Module member errors
  memberMinMaxLength = 9201,
  memberPhoneAlreadyExists = 9202,
  memberPhoneNumber = 9203,
  memberDate = 9204,
}

const nameFormat = `name must be between ${graphqlConfig.get(
  'minLength',
)} and ${graphqlConfig.get('maxLength')} characters`;

export const Errors: Map<ErrorType, string> = new Map([
  [ErrorType.userMinMaxLength.valueOf(), `user ${nameFormat}`],
  [ErrorType.userEmailAlreadyExists.valueOf(), 'email already exists'],
  [
    ErrorType.userEmailFormat.valueOf(),
    'email must be in an email format - having a @ and an extension, for example: test@gmail.com',
  ],
  [
    ErrorType.userPhotoUrlFormat.valueOf(),
    'photoUrl must be an URL address, for example: www.google.com',
  ],
  [ErrorType.memberMinMaxLength.valueOf(), `member ${nameFormat}`],
  [ErrorType.memberPhoneAlreadyExists.valueOf(), 'phone already exists'],
  [
    ErrorType.memberPhoneNumber.valueOf(),
    `phone number must be a valid phone number. ` +
      `please make sure you've added the country code with (+) in the beginning. ` +
      `${validPhoneNumbersExamples}`,
  ],
  [ErrorType.memberDate.valueOf(), 'dateOfBirth must be a Date instance'],
]);

export const DbErrors = {
  duplicateKey: 11000,
};
