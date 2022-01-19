/* eslint-disable max-len */
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
  userCanNotBeAssignedToMembers = 9108,
  userIdInvalid = 9109,

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
  memberInvalidZipCode = 9216,
  memberJournalNotFound = 9217,
  memberAllowedOnly = 9218,
  memberReplaceUserAlreadyExists = 9219,
  memberJournalImageNotFound = 9220,
  memberJournalAudioNotFound = 9221,
  memberJournalIdInvalid = 9222,
  memberOrgIdInvalid = 9223,
  memberIdInvalid = 9224,
  memberIdInconsistent = 9225,
  memberRecordingNotFound = 9226,
  memberRecordingSameUser = 9227,
  memberRecordingSameUserEdit = 9228,
  memberIdMetadataMissing = 9229,
  memberNotesAndNurseNotesNotProvided = 9230,

  // Notifications
  notificationMetadataInvalid = 9270,
  notificationMemberPlatformWeb = 9271,
  notificationMetadataWhenPast = 9273,
  notificationInvalidContent = 9274,
  notificationNotAllowed = 9275,
  notificationChatNotSupported = 9276,
  notificationNotAllowedForWebMember = 9277,
  notificationNotAllowedForMobileMember = 9278,
  notificationNotAllowedNoRequestedAppointment = 9279,

  // Module appointment errors
  appointmentIdNotFound = 9301,
  appointmentNotBeforeDate = 9302,
  appointmentNotBeforeDateInThePast = 9303,
  appointmentStartDate = 9304,
  appointmentEndDate = 9305,
  appointmentEndAfterStart = 9306,
  appointmentNoShow = 9307,
  appointmentCanNotBeUpdated = 9308,
  appointmentOverlaps = 9309,
  appointmentIdInvalid = 9310,
  appointmentStartDateOutOfRange = 9311,
  appointmentNotBeforeDateOutOfRange = 9312,

  // Module org errors
  orgAlreadyExists = 9401,
  orgTrialDurationOutOfRange = 9402,

  // Module availability errors
  availabilityNotFound = 9501,

  // Module communication errors
  communicationMemberUserNotFound = 9601,

  // Module Daily Report
  dailyReportQueryDateInvalid = 9701,
  dailyReportMutationDateInvalid = 9702,

  // Providers
  invalidSenderId = 9801,
  invalidPhoneNumberForMessaging = 9802,

  // Module Caregivers
  caregiverPhoneInvalid = 9901,
  caregiverEmailInvalid = 9902,
  caregiverIdInvalid = 9903,
  caregiverDeleteNotAllowed = 9904,

  // Todo's
  todoNotFound = 10001,
  todoIdInvalid = 10002,
  todoInvalidCronExpression = 10003,
  todoEndAfterStart = 10004,
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
const objectIdFormat = 'must be a 12 characters string';

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
  [ErrorType.userCanNotBeAssignedToMembers.valueOf(), 'user can not be assigned to member'],
  [ErrorType.userIdInvalid.valueOf(), `userId ${objectIdFormat}`],
  [ErrorType.memberMinMaxLength.valueOf(), `member ${nameFormat}`],
  [ErrorType.memberPhoneAlreadyExists.valueOf(), 'An error has occurred'],
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
  [ErrorType.memberInvalidZipCode.valueOf(), `invalid ZIP code`],
  [ErrorType.memberJournalNotFound.valueOf(), `journal id was not found`],
  [
    ErrorType.memberRegisterForNotificationToken.valueOf(),
    `token must contain only letters and numbers`,
  ],
  [ErrorType.memberAllowedOnly.valueOf(), `this resource is only allowed to members`],
  [ErrorType.memberReplaceUserAlreadyExists.valueOf(), `user is already assigned to member`],
  [ErrorType.memberJournalImageNotFound.valueOf(), `journal image was not found`],
  [ErrorType.memberJournalAudioNotFound.valueOf(), `journal audio was not found`],
  [ErrorType.memberJournalIdInvalid.valueOf(), `id ${objectIdFormat}`],
  [ErrorType.memberOrgIdInvalid.valueOf(), `orgId ${objectIdFormat}`],
  [ErrorType.memberIdInvalid.valueOf(), `memberId ${objectIdFormat}`],
  [ErrorType.memberRecordingNotFound.valueOf(), `recording not found`],
  [ErrorType.memberRecordingSameUser.valueOf(), `user cannot review own recording`],
  [ErrorType.memberRecordingSameUserEdit.valueOf(), `only user who wrote review can update it`],
  [ErrorType.memberIdMetadataMissing.valueOf(), `@MemberIdParam is missing on route`],
  [ErrorType.memberNotesAndNurseNotesNotProvided.valueOf(), `Notes or nurseNotes must be provided`],
  [
    ErrorType.notificationMetadataInvalid.valueOf(),
    `when calling type 'text' or 'textSms', 'content' in metadata is required ` +
      `when calling type 'video' or 'call', 'peerId' in metadata is required ` +
      `when calling type 'video' or 'call', 'when' in metadata is not allowed`,
  ],
  [
    ErrorType.notificationMemberPlatformWeb.valueOf(),
    `A web member cannot receive video or call notification`,
  ],
  [ErrorType.notificationMetadataWhenPast.valueOf(), `'when' in metadata must be in the future`],
  [ErrorType.notificationInvalidContent.valueOf(), `invalid content`],
  [
    ErrorType.notificationNotAllowed.valueOf(),
    `cannot receive video or call notification for member with isPushNotificationsEnabled=false`,
  ],
  [ErrorType.notificationChatNotSupported.valueOf(), `notification type chat is not supported`],
  [
    ErrorType.notificationNotAllowedForWebMember.valueOf(),
    `mobile notification is not allowed if member did not login to the ` +
      `app or/and isPushNotificationsEnabled=false`,
  ],
  [
    ErrorType.notificationNotAllowedForMobileMember.valueOf(),
    `web notification is not allowed if member login to the app`,
  ],
  [
    ErrorType.notificationNotAllowedNoRequestedAppointment.valueOf(),
    `scheduleAppointment notification can not be preformed since you do not have a requested appointment with this member`,
  ],
  [ErrorType.appointmentIdNotFound.valueOf(), 'appointment id was not found'],
  [ErrorType.appointmentNotBeforeDate.valueOf(), `notBefore ${dateInstanceFormat}`],
  [ErrorType.appointmentNotBeforeDateInThePast.valueOf(), 'notBefore must be in the future'],
  [ErrorType.appointmentStartDate.valueOf(), `start ${dateInstanceFormat}`],
  [ErrorType.appointmentEndDate.valueOf(), `end ${dateInstanceFormat}`],
  [
    ErrorType.appointmentStartDateOutOfRange.valueOf(),
    `appointment start date must not be over ${config.general.notificationRange} days in the future`,
  ],
  [
    ErrorType.appointmentNotBeforeDateOutOfRange.valueOf(),
    `appointment notBefore date must not be over ${config.general.notificationRange} days in the future`,
  ],
  [ErrorType.appointmentEndAfterStart.valueOf(), 'end date must be after start date'],
  [ErrorType.appointmentOverlaps.valueOf(), 'Appointment overlaps another appointment'],
  [
    ErrorType.appointmentNoShow.valueOf(),
    'if noShow=true, a `reason` field is mandatory as well. ' +
      'if noShow=false, a `reason` field is not required',
  ],
  [
    ErrorType.appointmentCanNotBeUpdated.valueOf(),
    `can not update an appointment with status='done'`,
  ],
  [ErrorType.appointmentIdInvalid.valueOf(), `appointment id ${objectIdFormat}`],
  [ErrorType.orgAlreadyExists.valueOf(), 'organization already exists'],
  [ErrorType.orgTrialDurationOutOfRange.valueOf(), 'trialDuration must not be less than 1'],
  [ErrorType.availabilityNotFound.valueOf(), 'availability id was not found'],
  [ErrorType.communicationMemberUserNotFound.valueOf(), 'member-user communication was not found'],
  [ErrorType.dailyReportQueryDateInvalid.valueOf(), 'daily report query - invalid date format'],
  [ErrorType.dailyReportMutationDateInvalid.valueOf(), 'daily report query - invalid date format'],
  [ErrorType.invalidSenderId.valueOf(), 'invalid sender id'],

  // Module Caregivers
  [ErrorType.caregiverPhoneInvalid.valueOf(), phoneFormat],
  [ErrorType.caregiverEmailInvalid.valueOf(), emailFormat],
  [
    ErrorType.memberIdInconsistent.valueOf(),
    'member id in request is inconsistent with logged in member id',
  ],
  [ErrorType.caregiverIdInvalid.valueOf(), 'caregiver id is invalid'],
  [ErrorType.caregiverDeleteNotAllowed.valueOf(), 'caregiver delete is not allowed'],
  [
    ErrorType.invalidPhoneNumberForMessaging.valueOf(),
    'invalid phone or landline - can not send SMS',
  ],
  [ErrorType.todoNotFound.valueOf(), 'todo id was not found'],
  [ErrorType.todoIdInvalid.valueOf(), `todo id ${objectIdFormat}`],
  [ErrorType.todoInvalidCronExpression.valueOf(), 'invalid cron expression'],
  [ErrorType.todoEndAfterStart.valueOf(), 'end date must be after start date'],
]);

export const DbErrors = {
  duplicateKey: 11000,
};

export const LogAsWarning = new Set([
  ...Errors.values(),
  'Forbidden resource',
  'Unauthorized',
  'Argument passed in must be a single String of 12 bytes or a string of 24 hex characters',
]);
