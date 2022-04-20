import { general, graphql } from 'config';
import { momentFormats } from './constants';

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
  userFailedToCreateOnExternalProvider = 9110,

  // Module member errors
  memberMinMaxLength = 9201,
  memberPhoneAlreadyExists = 9202,
  memberPhone = 9203,
  memberDateOfBirth = 9204,
  memberDischargeDate = 9205,
  memberEmailFormat = 9206,
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
  memberUploadAlreadyExistingGeneralDocument = 9231,

  //member admission
  memberAdmissionProcedureIdNotFound = 9300,
  memberAdmissionMedicationIdNotFound = 9301,
  memberAdmissionExternalAppointmentIdNotFound = 9302,
  memberAdmissionActivityIdNotFound = 9303,
  memberAdmissionWoundCareIdNotFound = 9304,

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
  notifyContentMetadataInvalid = 9280,

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
  availabilityIdInvalid = 9502,

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

  // To do's
  todoNotFound = 10001,
  todoIdInvalid = 10002,
  todoInvalidCronExpression = 10003,
  todoEndAfterStart = 10004,
  todoDoneNotFound = 10005,
  todoEndOrUpdateEndedOrUpdatedTodo = 10006,
  todoUnscheduled = 10007,
  todoCreateDoneStatus = 10008,
  todoDeleteDoneStatus = 10009,
  todoNotFoundOrApproveNotRequested = 10010,
  todoUnscheduledUpdate = 10011,
  todoStartDateInThePast = 10012,
  todoEndDateInThePast = 10013,
  todoDoneIdInvalid = 10014,
  todoUpdateActionTodo = 10015,
  todoEndActionTodo = 10016,

  // Module Care
  redFlagIdInvalid = 10101,
  barrierIdInvalid = 10102,
  carePlanIdInvalid = 10103,
  barrierNotFound = 10104,
  carePlanNotFound = 10105,
  redFlagNotFound = 10106,
  carePlanTypeInputInvalid = 10107,
  carePlanTypeInvalid = 10108,
  carePlanTypeNotFound = 10109,
  barrierTypeInvalid = 10110,
  barrierTypeNotFound = 10111,
  redFlagTypeInvalid = 10112,
  redFlagTypeNotFound = 10113,

  // Module Questionnaire
  questionnaireItemsDuplicateCode = 10201,
  questionnaireItemMissingOptionsCode = 10202,
  questionnaireItemMissingRangeCode = 10203,
  questionnaireSeverityLevelInvalidCode = 10204,
  questionnaireResponseInvalidResponse = 10205,
  questionnaireNotFound = 10206,
  questionnaireIdInvalid = 10207,
  questionnaireResponseInvalidResponseEmptyAnswerList = 10208,
  questionnaireInvalidIdCode = 10209,
  questionnaireResponseInvalidIdCode = 10210,
  questionnaireNotAssignableToMember = 10211,

  // Module Alert
  alertIdInvalid = 10301,

  // Module Org
  orgIdInvalid = 10401,
}

const nameFormat =
  `name must be between ${graphql.validators.name.minLength} and ` +
  `${graphql.validators.name.maxLength} characters`;
const dateTimeInstanceFormat = 'must be a DateTime instance';
const dateInstanceFormat = `must be an only Date instance: ${momentFormats.date}`;
const emailFormat =
  'email must be in an email format - having a @ and an extension, for example: test@gmail.com';
const phoneFormat =
  `phone number must be a valid phone number. ` +
  `please make sure you've added the country code with (+) in the beginning. ` +
  `${validPhoneExamples}`;
const objectIdFormat = 'must be a 12 characters string';
const notFoundPrefix = 'id was not found';

export const Errors: Map<ErrorType, string> = new Map([
  [ErrorType.userMinMaxLength.valueOf(), `user ${nameFormat}`],
  [ErrorType.userIdOrEmailAlreadyExists.valueOf(), 'id or/and email already exists'],
  [ErrorType.userEmailFormat.valueOf(), emailFormat],
  [
    ErrorType.userAvatarFormat.valueOf(),
    'avatar must be an URL address, for example: www.google.com',
  ],
  [ErrorType.userNotFound.valueOf(), `user ${notFoundPrefix}`],
  [ErrorType.slotsParams.valueOf(), 'userId or appointmentId must be provided'],
  [ErrorType.userPhone.valueOf(), phoneFormat],
  [ErrorType.userCanNotBeAssignedToMembers.valueOf(), 'user can not be assigned to member'],
  [ErrorType.userIdInvalid.valueOf(), `userId ${objectIdFormat}`],
  [
    ErrorType.userFailedToCreateOnExternalProvider.valueOf(),
    `Failed to create a user in external provider`,
  ],
  [ErrorType.memberMinMaxLength.valueOf(), `member ${nameFormat}`],
  [ErrorType.memberPhoneAlreadyExists.valueOf(), 'An error has occurred'],
  [ErrorType.memberPhone.valueOf(), phoneFormat],
  [ErrorType.memberDateOfBirth.valueOf(), `dateOfBirth ${dateInstanceFormat}`],
  [ErrorType.memberDischargeDate.valueOf(), `dischargeDate ${dateInstanceFormat}`],
  [ErrorType.memberEmailFormat.valueOf(), emailFormat],
  [ErrorType.memberTaskDeadline.valueOf(), `deadline ${dateTimeInstanceFormat}`],
  [ErrorType.memberActionItemIdNotFound.valueOf(), `action item ${notFoundPrefix}`],
  [ErrorType.memberNotFound.valueOf(), `member ${notFoundPrefix}`],
  [ErrorType.memberPrimaryUserIdNotInUsers.valueOf(), 'primaryUserId must exists in usersIds list'],
  [ErrorType.memberAdmitDate.valueOf(), `admitDate ${dateInstanceFormat}`],
  [ErrorType.memberRecordingIdAlreadyExists.valueOf(), `id already exists`],
  [ErrorType.memberRegisterWebPlatform.valueOf(), `cant register member with platform web`],
  [ErrorType.memberInvalidZipCode.valueOf(), `invalid ZIP code`],
  [ErrorType.memberJournalNotFound.valueOf(), `journal ${notFoundPrefix}`],
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
    ErrorType.memberUploadAlreadyExistingGeneralDocument.valueOf(),
    `can not upload an already existing document`,
  ],
  [ErrorType.memberAdmissionProcedureIdNotFound.valueOf(), `procedure ${notFoundPrefix}`],
  [ErrorType.memberAdmissionMedicationIdNotFound.valueOf(), `medication ${notFoundPrefix}`],
  [
    ErrorType.memberAdmissionExternalAppointmentIdNotFound.valueOf(),
    `external appointment ${notFoundPrefix}`,
  ],
  [ErrorType.memberAdmissionActivityIdNotFound.valueOf(), `activity ${notFoundPrefix}`],
  [ErrorType.memberAdmissionWoundCareIdNotFound.valueOf(), `wound care ${notFoundPrefix}`],
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
    // eslint-disable-next-line max-len
    `scheduleAppointment notification can not be preformed since you do not have a requested appointment with this member`,
  ],
  [
    ErrorType.notifyContentMetadataInvalid.valueOf(),
    // eslint-disable-next-line max-len
    `when calling notify content with contentType answerQuestionnaire questionnaireId must be provided in metadata`,
  ],
  [ErrorType.appointmentIdNotFound.valueOf(), `appointment ${notFoundPrefix}`],
  [ErrorType.appointmentNotBeforeDate.valueOf(), `notBefore ${dateTimeInstanceFormat}`],
  [ErrorType.appointmentNotBeforeDateInThePast.valueOf(), 'notBefore must be in the future'],
  [ErrorType.appointmentStartDate.valueOf(), `start ${dateTimeInstanceFormat}`],
  [ErrorType.appointmentEndDate.valueOf(), `end ${dateTimeInstanceFormat}`],
  [
    ErrorType.appointmentStartDateOutOfRange.valueOf(),
    `appointment start date must not be over ${general.notificationRange} days in the future`,
  ],
  [
    ErrorType.appointmentNotBeforeDateOutOfRange.valueOf(),
    `appointment notBefore date must not be over ${general.notificationRange} days in the future`,
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
  [ErrorType.availabilityNotFound.valueOf(), `availability ${notFoundPrefix}`],
  [ErrorType.availabilityIdInvalid.valueOf(), `availability id ${objectIdFormat}`],
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
  [ErrorType.todoNotFound.valueOf(), `todo ${notFoundPrefix}`],
  [ErrorType.todoIdInvalid.valueOf(), `todo id ${objectIdFormat}`],
  [ErrorType.todoDoneIdInvalid.valueOf(), `todoDone id ${objectIdFormat}`],
  [ErrorType.todoUpdateActionTodo.valueOf(), `can not update action todo`],
  [ErrorType.todoEndActionTodo.valueOf(), `member can not end action todo`],
  [ErrorType.todoInvalidCronExpression.valueOf(), 'invalid cron expression'],
  [ErrorType.todoEndAfterStart.valueOf(), 'end date must be after start date'],
  [ErrorType.todoDoneNotFound.valueOf(), `todoDone ${notFoundPrefix}`],
  [
    ErrorType.todoEndOrUpdateEndedOrUpdatedTodo.valueOf(),
    'can not end or update an already ended or updated todo',
  ],
  [
    ErrorType.todoUnscheduled.valueOf(),
    'scheduled todo must have cron expression and start, end is optional, ' +
      'unscheduled todo can not have cron expression start and end',
  ],
  [
    ErrorType.todoCreateDoneStatus.valueOf(),
    'can not create todoDone for todo with status ended or requested',
  ],
  [ErrorType.todoDeleteDoneStatus.valueOf(), 'can not delete todoDone for todo with status ended'],
  [
    ErrorType.todoNotFoundOrApproveNotRequested.valueOf(),
    'todo not found or todo status not requested',
  ],
  [
    ErrorType.todoUnscheduledUpdate.valueOf(),
    'scheduled todo must have cron expression, start and end are optional, ' +
      'unscheduled todo can not have cron expression start and end',
  ],
  [ErrorType.todoStartDateInThePast.valueOf(), 'start must be in the future'],
  [ErrorType.todoEndDateInThePast.valueOf(), 'end must be in the future'],
  // Module Care
  [ErrorType.redFlagIdInvalid.valueOf(), 'invalid red flag id'],
  [ErrorType.barrierIdInvalid.valueOf(), 'invalid barrier id'],
  [ErrorType.carePlanIdInvalid.valueOf(), 'invalid care plan id'],
  [ErrorType.barrierNotFound.valueOf(), `barrier ${notFoundPrefix}`],
  [ErrorType.carePlanNotFound.valueOf(), `care plan ${notFoundPrefix}`],
  [
    ErrorType.carePlanTypeInputInvalid.valueOf(),
    'invalid care plan type input - must be either id or custom',
  ],
  [
    ErrorType.questionnaireItemsDuplicateCode.valueOf(),
    'invalid questionnaire items list - item code values are not unique',
  ],
  [
    ErrorType.questionnaireItemMissingOptionsCode.valueOf(),
    'invalid questionnaire items list - missing option code for `choice` type items',
  ],
  [
    ErrorType.questionnaireItemMissingRangeCode.valueOf(),
    'invalid questionnaire items list - missing range value for `range` type items',
  ],
  [
    ErrorType.questionnaireSeverityLevelInvalidCode.valueOf(),
    'invalid questionnaire severity level list',
  ],
  [ErrorType.questionnaireResponseInvalidResponse.valueOf(), 'invalid questionnaire response'],
  [ErrorType.questionnaireNotFound.valueOf(), 'questionnaire not found'],
  [ErrorType.questionnaireIdInvalid.valueOf(), `questionnaireId ${objectIdFormat}`],
  [
    ErrorType.questionnaireResponseInvalidResponseEmptyAnswerList.valueOf(),
    'invalid questionnaire response - empty answer list',
  ],
  [ErrorType.questionnaireInvalidIdCode.valueOf(), `questionnaire id ${objectIdFormat}`],
  [
    ErrorType.questionnaireResponseInvalidIdCode.valueOf(),
    `questionnaire response id ${objectIdFormat}`,
  ],
  [
    ErrorType.questionnaireNotAssignableToMember.valueOf(),
    'questionnaire not assignable to member',
  ],
  [ErrorType.redFlagNotFound.valueOf(), `red flag ${notFoundPrefix}`],
  [ErrorType.carePlanTypeInvalid.valueOf(), 'invalid care plan type'],
  [ErrorType.carePlanTypeNotFound.valueOf(), 'care plan type was not found'],
  [ErrorType.barrierTypeInvalid.valueOf(), 'invalid barrier type'],
  [ErrorType.barrierTypeNotFound.valueOf(), 'barrier type was not found'],
  [ErrorType.alertIdInvalid.valueOf(), `alertId ${objectIdFormat}`],
  [ErrorType.orgIdInvalid.valueOf(), `orgId ${objectIdFormat}`],
  [ErrorType.redFlagTypeInvalid.valueOf(), 'invalid red flag type'],
  [ErrorType.redFlagTypeNotFound.valueOf(), 'red flag type was not found'],
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
