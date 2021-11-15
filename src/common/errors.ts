import * as config from 'config';

const graphqlConfig = config.get('graphql.validators.name');

export const validPhoneExamples =
  'examples for a valid phone number: +41 311111111, +41 (0)31 633 60 01, +49 9072 1111, etc..';

export enum ErrorType {
  // Module user errors
  userMinMaxLength = 9101,
  userIdOrEmailAlreadyExists = 9102,
  userEmailFormat = 9103,
  userAvatarFormat = 9104,
  userPhone = 9105,
  userNotFound = 9106,
  slotsParams = 9107,

  // Module member errors
  memberMinMaxLength = 9201,
  memberPhoneAlreadyExists = 9202,
  memberPhone = 9203,
  memberDateOfBirth = 9204,
  memberDischargeDate = 9205,
  memberEmailFormat = 9206,
  memberGoalIdNotFound = 9207,
  memberTaskDeadline = 9208,
  memberActionItemIdNotFound = 9209,
  memberNotFound = 9210,
  memberPrimaryUserIdNotInUsers = 9211,
  memberAdmitDate = 9212,
  memberRegisterForNotificationToken = 9213,
  memberRecordingIdAlreadyExists = 9214,
  memberRegisterWebPlatform = 9215,
  invalidZipCode = 9216,
  invalidContent = 9217,

  // Notifications
  notificationMetadataInvalid = 9270,
  notificationMemberPlatformWeb = 9271,
  notificationNotFound = 9272,
  notificationMetadataWhenPast = 9273,

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

  // Module availability errors
  availabilityNotFound = 9501,

  // Module communication errors
  communicationMemberUserNotFound = 9601,
  communicationInfoIsNotAllowed = 9602,

  // Module Daily Report
  dailyReportQueryDateInvalid = 9701,
  dailyReportMutationDateInvalid = 9702,

  // Providers
  invalidSenderId = 9801,
}

const nameFormat = `name must be between ${graphqlConfig.get('minLength')} and ${graphqlConfig.get(
  'maxLength',
)} characters`;
const dateInstanceFormat = 'must be a Date instance';
const emailFormat =
  'email must be in an email format - having a @ and an extension, for example: test@gmail.com';
const phoneFormat =
  `phone number must be a valid phone number. ` +
  `please make sure you've added the country code with (+) in the beginning. ` +
  `${validPhoneExamples}`;

export const Errors: Map<ErrorType, string> = new Map([
  [ErrorType.userMinMaxLength.valueOf(), `user ${nameFormat}`],
  [ErrorType.userIdOrEmailAlreadyExists.valueOf(), 'id or/and email already exists'],
  [ErrorType.userEmailFormat.valueOf(), emailFormat],
  [
    ErrorType.userAvatarFormat.valueOf(),
    'avatar must be an URL address, for example: www.google.com',
  ],
  [ErrorType.userNotFound.valueOf(), 'user id was not found'],
  [ErrorType.slotsParams.valueOf(), 'userId or appointmentId must be provided'],
  [ErrorType.userPhone.valueOf(), phoneFormat],
  [ErrorType.memberMinMaxLength.valueOf(), `member ${nameFormat}`],
  [ErrorType.memberPhoneAlreadyExists.valueOf(), 'phone already exists'],
  [ErrorType.memberPhone.valueOf(), phoneFormat],
  [ErrorType.memberDateOfBirth.valueOf(), `dateOfBirth ${dateInstanceFormat}`],
  [ErrorType.memberDischargeDate.valueOf(), `dischargeDate ${dateInstanceFormat}`],
  [ErrorType.memberEmailFormat.valueOf(), emailFormat],
  [ErrorType.memberGoalIdNotFound.valueOf(), 'goal id was not found'],
  [ErrorType.memberTaskDeadline.valueOf(), `deadline ${dateInstanceFormat}`],
  [ErrorType.memberActionItemIdNotFound.valueOf(), 'action item id was not found'],
  [ErrorType.memberNotFound.valueOf(), 'member id was not found'],
  [ErrorType.memberPrimaryUserIdNotInUsers.valueOf(), 'primaryUserId must exists in usersIds list'],
  [ErrorType.memberAdmitDate.valueOf(), `admitDate ${dateInstanceFormat}`],
  [ErrorType.memberRecordingIdAlreadyExists.valueOf(), `id already exists`],
  [ErrorType.memberRegisterWebPlatform.valueOf(), `cant register member with platform web`],
  [ErrorType.invalidZipCode.valueOf(), `invalid ZIP code`],
  [ErrorType.invalidContent.valueOf(), `invalid content`],
  [
    ErrorType.memberRegisterForNotificationToken.valueOf(),
    `token must contain only letters and numbers`,
  ],
  [
    ErrorType.notificationMetadataInvalid.valueOf(),
    `when calling type 'text' or 'textSms', 'content' in metadata is required ` +
      `when calling type 'video' or 'call', 'peerId' in metadata is required ` +
      `when calling type 'video' or 'call', 'when' and 'chatLink' in metadata is not allowed`,
  ],
  [
    ErrorType.notificationMemberPlatformWeb.valueOf(),
    `A web member cannot receive video or call notification`,
  ],
  [ErrorType.notificationNotFound.valueOf(), `notification not found`],
  [ErrorType.notificationMetadataWhenPast.valueOf(), `'when' in metadata must be in the future`],
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
  [ErrorType.availabilityNotFound.valueOf(), 'availability id was not found'],
  [ErrorType.communicationMemberUserNotFound.valueOf(), 'member-user communication was not found'],
  [ErrorType.communicationInfoIsNotAllowed.valueOf(), 'communication info is not allowed'],

  [ErrorType.dailyReportQueryDateInvalid.valueOf(), 'daily report query - invalid date format'],
  [ErrorType.dailyReportMutationDateInvalid.valueOf(), 'daily report query - invalid date format'],
  [ErrorType.invalidSenderId.valueOf(), 'invalid sender id'],
]);

export const DbErrors = {
  duplicateKey: 11000,
};
