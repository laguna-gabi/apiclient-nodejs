import {
  AppointmentMethod,
  AppointmentStatus,
  BarrierDomain,
  BarrierStatus,
  BaseCarePlanParams,
  CarePlanStatus,
  CarePlanTypeInput,
  CreateCarePlanParams,
  MemberRole,
  Notes,
  Relationship,
  Scores,
  User,
  UserRole,
  defaultUserParams,
} from '@argus/hepiusClient';
import {
  ContentKey,
  ExternalKey,
  IUpdateClientSettings,
  InnerQueueTypes,
  RegisterInternalKey,
} from '@argus/irisClient';
import {
  CancelNotificationType,
  ClientCategory,
  Language,
  NotificationType,
  Platform,
  ServiceName,
  generateId,
  generateObjectId,
  generatePhone,
  generateZipCode,
  randomEnum,
} from '@argus/pandora';
import { general, graphql, hosts } from 'config';
import { add, addDays, format, sub, subDays } from 'date-fns';
import {
  company,
  datatype,
  address as fakerAddress,
  date as fakerDate,
  image,
  internet,
  lorem,
  name,
  random,
  system,
} from 'faker';
import { sign } from 'jsonwebtoken';
import { Types } from 'mongoose';
import { v4 } from 'uuid';
import {
  ActionItem,
  ActionItemCategory,
  ActionItemLink,
  ActionItemLinkType,
  ActionItemPriority,
  ActionItemStatus,
  CreateOrSetActionItemParams,
  RelatedEntity,
  RelatedEntityType,
} from '../src/actionItem';
import {
  EndAppointmentParams,
  RequestAppointmentParams,
  ScheduleAppointmentParams,
  UpdateNotesParams,
} from '../src/appointment';
import { AvailabilityInput } from '../src/availability';
import {
  CreateBarrierParams,
  CreateRedFlagParams,
  DeleteCarePlanParams,
  UpdateBarrierParams,
  UpdateCarePlanParams,
  UpdateRedFlagParams,
} from '../src/care';
import {
  CreateBarrierParamsWizard,
  CreateRedFlagParamsWizard,
  SubmitCareWizardParams,
} from '../src/care/wizard.dto';
import {
  Alert,
  AlertType,
  ChangeType,
  ItemType,
  RecordingType,
  momentFormats,
  reformatDate,
} from '../src/common';
import { Communication, GetCommunicationParams } from '../src/communication';
import {
  CheckMobileVersionParams,
  CheckMobileVersionResponse,
  CreateMobileVersionParams,
  MobileVersion,
  UpdateFaultyMobileVersionsParams,
  UpdateMinMobileVersionParams,
} from '../src/configuration';
import { DailyReport, DailyReportCategoriesInput } from '../src/dailyReport';
import {
  Activity,
  AddCaregiverParams,
  AdmitSource,
  AdmitType,
  AudioFormat,
  ChangeAdmissionDiagnosisParams,
  ChangeAdmissionDietaryParams,
  ChangeAdmissionExternalAppointmentParams,
  ChangeAdmissionMedicationParams,
  ChangeAdmissionTreatmentRenderedParams,
  ChangeMemberDnaParams,
  ClinicalStatus,
  DiagnosisSeverity,
  DietaryCategory,
  DietaryName,
  DischargeTo,
  ExternalAppointmentStatus,
  ExternalAppointmentType,
  GetMemberUploadJournalAudioLinkParams,
  GetMemberUploadJournalImageLinkParams,
  ImageFormat,
  Journey,
  MedicationStatus,
  PrimaryDiagnosisType,
  ReadmissionRisk,
  ReplaceMemberOrgParams,
  SecondaryDiagnosisType,
  SetGeneralNotesParams,
  UpdateCaregiverParams,
  UpdateJournalTextParams,
  UpdateJourneyParams,
  WarningSigns,
  WoundCare,
} from '../src/journey';
import {
  AddInsuranceParams,
  AppointmentCompose,
  CancelNotifyParams,
  CreateMemberParams,
  DeleteDischargeDocumentParams,
  DeleteMemberParams,
  DischargeDocumentType,
  Honorific,
  InternalCreateMemberParams,
  MaritalStatus,
  Member,
  MemberConfig,
  NotifyContentParams,
  NotifyParams,
  ReplaceUserForMemberParams,
  Sex,
  UpdateMemberConfigParams,
  UpdateMemberParams,
  defaultMemberParams,
} from '../src/member';
import { CreateOrgParams, Org, OrgType } from '../src/org';
import {
  Answer,
  CreateQuestionnaireParams,
  Item,
  Questionnaire,
  QuestionnaireResponse,
  QuestionnaireType,
  SubmitQuestionnaireResponseParams,
} from '../src/questionnaire';
import {
  CompleteMultipartUploadParams,
  MultipartUploadRecordingLinkParams,
  Recording,
  RecordingLinkParams,
  UpdateRecordingParams,
  UpdateRecordingReviewParams,
} from '../src/recording';
import { Dispatch } from '../src/services';
import {
  ActionTodoLabel,
  CreateActionTodoParams,
  CreateTodoDoneParams,
  CreateTodoParams,
  GetTodoDonesParams,
  ResourceType,
  Todo,
  TodoDone,
  TodoLabel,
  TodoStatus,
  UpdateTodoParams,
} from '../src/todo';
import { CreateUserParams, GetSlotsParams, UpdateUserParams } from '../src/user';

/**************************************************************************************************
 ********************************************* Member *********************************************
 *************************************************************************************************/

export const mockGenerateMember = (primaryUser?: User): Member => {
  const firstName = name.firstName();
  const lastName = name.lastName();
  const user = primaryUser || mockGenerateUser();
  const admitDate = subDays(new Date(), 7);
  const deceasedDate = addDays(admitDate, 3);
  return {
    id: generateId(),
    authId: v4(),
    primaryUserId: generateObjectId(user.id),
    phone: generatePhone(),
    phoneType: 'mobile',
    deviceId: datatype.uuid(),
    firstName,
    lastName,
    dateOfBirth: generateDateOnly(fakerDate.past()),
    users: [user],
    sex: defaultMemberParams.sex,
    createdAt: fakerDate.past(1),
    updatedAt: fakerDate.past(1),
    honorific: defaultMemberParams.honorific,
    roles: [MemberRole.member],
    race: defaultMemberParams.race,
    maritalStatus: MaritalStatus.single,
    zipCode: generateZipCode(),
    address: {
      street: fakerAddress.streetName(),
      city: fakerAddress.city(),
      state: fakerAddress.state(),
    },
    deceased: { cause: lorem.sentence(), date: generateDateOnly(deceasedDate) },
  };
};

export const generateCreateMemberParams = ({
  authId = v4(),
  phone = generatePhone(),
  firstName = name.firstName(),
  lastName = name.lastName(),
  dateOfBirth = generateDateOnly(fakerDate.past()),
  orgId,
  sex,
  email,
  language,
  zipCode = generateZipCode(),
  honorific = defaultMemberParams.honorific,
  userId,
  maritalStatus = MaritalStatus.single,
  height = generateRandomHeight(),
  weight = generateRandomWeight(),
}: Partial<CreateMemberParams> & { orgId: string }): CreateMemberParams & { orgId: string } => {
  return {
    authId,
    phone,
    firstName,
    lastName,
    dateOfBirth,
    orgId,
    sex,
    email,
    language,
    zipCode,
    honorific,
    userId,
    maritalStatus,
    height,
    weight,
  };
};

export const generateInternalCreateMemberParams = ({
  authId = v4(),
  phone = generatePhone(),
  phoneType = 'mobile',
  firstName = name.firstName(),
  lastName = name.lastName(),
  dateOfBirth = generateDateOnly(fakerDate.past()),
  sex,
  email,
  language,
  zipCode = generateZipCode(),
  honorific = defaultMemberParams.honorific,
  userId,
}: Partial<InternalCreateMemberParams> = {}): Omit<InternalCreateMemberParams, 'orgId'> => {
  return {
    authId,
    phone,
    phoneType,
    firstName,
    lastName,
    dateOfBirth,
    sex,
    email,
    language,
    zipCode,
    honorific,
    userId,
  };
};

export const generateUpdateMemberParams = ({
  id = generateId(),
  authId = v4(),
  firstName = name.firstName(),
  lastName = name.lastName(),
  sex = Sex.female,
  email = generateEmail(),
  zipCode = generateZipCode(),
  phoneSecondary = generatePhone(),
  dateOfBirth = generateDateOnly(fakerDate.past()),
  address = {
    street: fakerAddress.streetName(),
    city: fakerAddress.city(),
    state: fakerAddress.state(),
  },
  honorific = Honorific.mr,
  deviceId = datatype.uuid(),
  maritalStatus = MaritalStatus.married,
  healthPlan = generateHealthPlan(),
  preferredGenderPronoun = datatype.string(10),
  deceased = {
    cause: lorem.sentence(),
    date: generateDateOnly(fakerDate.past()),
  },
}: Partial<UpdateMemberParams> = {}): UpdateMemberParams => {
  return {
    id,
    authId,
    firstName,
    lastName,
    sex,
    email,
    zipCode,
    phoneSecondary,
    dateOfBirth,
    address,
    honorific,
    deviceId,
    healthPlan,
    preferredGenderPronoun,
    maritalStatus,
    deceased,
  };
};

export const generateAppointmentComposeParams = (): AppointmentCompose => {
  const start = fakerDate.soon(5);
  const end = new Date(start);
  end.setHours(end.getHours() + 2);

  return {
    memberId: generateId(),
    memberName: `${name.firstName()} ${name.lastName()}`,
    userId: generateId(),
    userName: `${name.firstName()} ${name.lastName()}`,
    start,
    end,
    status: AppointmentStatus.scheduled,
  };
};

export const generateDeleteDischargeDocumentParams = ({
  memberId = generateId(),
  dischargeDocumentType = DischargeDocumentType.Instructions,
}: // eslint-disable-next-line max-len
Partial<DeleteDischargeDocumentParams> = {}): DeleteDischargeDocumentParams => {
  return { memberId, dischargeDocumentType };
};

export const generateUpdateClientSettings = ({
  member,
  memberConfig,
  journey,
  org,
}: {
  member?: Member;
  memberConfig?: MemberConfig;
  journey?: Journey;
  org?: Org;
}): IUpdateClientSettings => {
  return {
    type: InnerQueueTypes.updateClientSettings,
    id: memberConfig?.memberId?.toString() || member.id.toString(),
    clientCategory: ClientCategory.member,
    phone: member?.phone,
    firstName: member?.firstName,
    lastName: member?.lastName,
    orgName: org?.name,
    zipCode: member?.zipCode || org?.zipCode,
    language: memberConfig?.language,
    platform: memberConfig?.platform,
    isPushNotificationsEnabled: memberConfig?.isPushNotificationsEnabled,
    isAppointmentsReminderEnabled: memberConfig?.isAppointmentsReminderEnabled,
    isRecommendationsEnabled: memberConfig?.isRecommendationsEnabled,
    isTodoNotificationsEnabled: memberConfig?.isTodoNotificationsEnabled,
    externalUserId: memberConfig?.externalUserId,
    firstLoggedInAt: journey?.firstLoggedInAt,
  };
};

export const generateDeleteMemberParams = ({
  id = generateId(),
  hard = false,
}: Partial<DeleteMemberParams> = {}) => {
  return {
    id,
    hard,
  };
};

export const generateReplaceUserForMemberParams = ({
  userId = generateId(),
  memberId = generateId(),
}: Partial<ReplaceUserForMemberParams> = {}): ReplaceUserForMemberParams => {
  return { userId, memberId };
};

export const generateReplaceMemberOrgParams = ({
  memberId = generateId(),
  orgId = generateId(),
}: Partial<ReplaceMemberOrgParams> = {}): ReplaceMemberOrgParams => {
  return { memberId, orgId };
};

/**************************************************************************************************
 ****************************************** MemberConfig ******************************************
 *************************************************************************************************/

export const mockGenerateMemberConfig = ({
  platform = Platform.ios,
  isPushNotificationsEnabled = true,
}: Partial<MemberConfig> = {}): MemberConfig => {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  return {
    memberId: generateObjectId(),
    externalUserId: v4(),
    platform,
    isPushNotificationsEnabled,
    isRecommendationsEnabled: true,
    isTodoNotificationsEnabled: true,
    isAppointmentsReminderEnabled: true,
    accessToken: generateId(),
    articlesPath: system.directoryPath(),
    language: defaultMemberParams.language,
    systemVersion: datatype.number({ min: 5, max: 10 }).toString(),
    brand: lorem.word(),
    codePushVersion: v4(),
    appVersion: v4(),
    buildVersion: v4(),
  };
};

export const generateMemberConfig = ({
  memberId = generateObjectId(),
  externalUserId = v4(),
  platform = Platform.ios,
  isPushNotificationsEnabled = true,
  accessToken = generateId(),
  articlesPath = system.directoryPath(),
  language = defaultMemberParams.language,
}: Partial<MemberConfig> = {}): MemberConfig => {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  return {
    memberId,
    externalUserId,
    platform,
    accessToken,
    isPushNotificationsEnabled,
    articlesPath,
    language,
  };
};

export const generateUpdateMemberConfigParams = ({
  memberId = generateId(),
  platform = Platform.web,
  isPushNotificationsEnabled = false,
  isAppointmentsReminderEnabled = false,
  isRecommendationsEnabled = false,
  isTodoNotificationsEnabled = false,
  language = Language.en,
  systemVersion = datatype.number({ min: 5, max: 10 }).toString(),
  brand = lorem.word(),
  codePushVersion = v4(),
  appVersion = v4(),
  buildVersion = v4(),
}: Partial<UpdateMemberConfigParams> = {}): UpdateMemberConfigParams => {
  return {
    memberId,
    platform,
    isPushNotificationsEnabled,
    isAppointmentsReminderEnabled,
    isRecommendationsEnabled,
    isTodoNotificationsEnabled,
    language,
    systemVersion,
    brand,
    codePushVersion,
    appVersion,
    buildVersion,
  };
};

/**************************************************************************************************
 ********************************************* Journey ********************************************
 *************************************************************************************************/

export const mockGenerateJourney = ({
  memberId,
  orgId,
}: {
  memberId: string;
  orgId?: string;
}): Journey => ({
  id: generateId(),
  memberId: new Types.ObjectId(memberId),
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  org: orgId || generateId(),
  firstLoggedInAt: fakerDate.past(2),
  lastLoggedInAt: fakerDate.past(1),
  admissions: [],
  readmissionRisk: ReadmissionRisk.low,
  isGraduated: false,
  generalNotes: lorem.sentence(),
});

export const generateUpdateJourneyParams = ({
  memberId = generateId(),
  readmissionRisk = ReadmissionRisk.low,
}: Partial<UpdateJourneyParams> = {}): UpdateJourneyParams => ({
  memberId,
  readmissionRisk,
});

export const generateSetGeneralNotesParams = ({
  memberId = generateId(),
  note = lorem.sentence(),
}: Partial<SetGeneralNotesParams> = {}): SetGeneralNotesParams => {
  return { memberId, note };
};

export const generateAddCaregiverParams = ({
  firstName = name.firstName(),
  lastName = name.lastName(),
  email = internet.email(),
  relationship = Relationship.neighbour,
  phone = '+12133734253',
  memberId,
}: Partial<AddCaregiverParams> = {}): AddCaregiverParams => {
  return { firstName, lastName, email, relationship, phone, memberId };
};

export const generateUpdateCaregiverParams = ({
  id = generateId(),
  firstName = name.firstName(),
  lastName = name.lastName(),
  email = internet.email(),
  relationship = Relationship.neighbour,
  phone = '+12133734253',
  memberId,
}: Partial<UpdateCaregiverParams> = {}): UpdateCaregiverParams => {
  return { id, firstName, lastName, email, relationship, phone, memberId };
};

export const generateRelatedEntity = ({
  id = generateId(),
  type = randomEnum(RelatedEntityType) as RelatedEntityType,
}: Partial<RelatedEntity> = {}): RelatedEntity => {
  return { id, type };
};

/**************************************************************************************************
 ********************************************* User ***********************************************
 *************************************************************************************************/

export const mockGenerateUser = (): User => {
  const firstName = name.firstName();
  const lastName = name.lastName();
  return {
    id: generateId(),
    firstName,
    lastName,
    email: generateEmail(),
    roles: [UserRole.lagunaCoach],
    avatar: image.imageUrl(),
    description: lorem.sentence(),
    createdAt: fakerDate.past(1),
    phone: generatePhone(),
    authId: v4(),
    username: firstName,
    lastMemberAssignedAt: new Date(0),
    lastQueryAlert: fakerDate.past(2),
    inEscalationGroup: true,
    orgs: [generateId(), generateId()],
  };
};

export const generateCreateUserParams = ({
  roles = [UserRole.lagunaCoach],
  firstName = name.firstName(21),
  lastName = name.lastName(21),
  email = generateEmail(),
  avatar = image.imageUrl(),
  description = lorem.sentence(),
  phone = generatePhone(),
  title = name.title(),
  maxMembers = defaultUserParams.maxMembers,
  languages = [Language.en, Language.es],
  orgs = [generateId(), generateId()],
}: Partial<CreateUserParams> = {}): CreateUserParams => {
  return {
    firstName,
    lastName,
    email,
    roles,
    avatar,
    description,
    phone,
    title,
    maxMembers,
    languages,
    orgs,
  };
};

export const generateUpdateUserParams = ({
  id = generateId(),
  roles = [UserRole.lagunaNurse],
  firstName = name.firstName(21),
  lastName = name.lastName(21),
  avatar = image.imageUrl(),
  description = lorem.sentence(),
  title = name.title(),
  maxMembers = defaultUserParams.maxMembers + 1,
  languages = [Language.en, Language.es],
  orgs = [generateId(), generateId()],
}: Partial<UpdateUserParams> = {}): UpdateUserParams => {
  return {
    id,
    firstName,
    lastName,
    roles,
    avatar,
    description,
    title,
    maxMembers,
    languages,
    orgs,
  };
};

export const generateGetSlotsParams = ({
  userId = null,
  appointmentId = null,
  notBefore = null,
  orgIds,
}: Partial<GetSlotsParams> = {}): GetSlotsParams => {
  return {
    userId,
    appointmentId,
    notBefore,
    orgIds,
  };
};

/**************************************************************************************************
 **************************************** Notification ********************************************
 *************************************************************************************************/

export const generateNotifyParams = ({
  userId = generateId(),
  memberId = generateId(),
  type = NotificationType.call,
  metadata = { peerId: v4(), content: 'test' },
}: Partial<NotifyParams> = {}): NotifyParams => {
  return { userId, memberId, type, metadata };
};

export const generateNotifyContentParams = ({
  userId = generateId(),
  memberId = generateId(),
  contentKey = ExternalKey.setCallPermissions,
  metadata = { questionnaireId: generateId() },
}: Partial<NotifyContentParams> = {}): NotifyContentParams => {
  return { userId, memberId, contentKey, metadata };
};

export const generateCancelNotifyParams = ({
  memberId = generateId(),
  type = CancelNotificationType.cancelCall,
  metadata = { peerId: v4() },
}: Partial<CancelNotifyParams> = {}): CancelNotifyParams => {
  return { memberId, type, metadata };
};

export const mockGenerateDispatch = ({
  dispatchId = generateId(),
  notificationType = randomEnum(NotificationType) as NotificationType,
  recipientClientId = generateId(),
  senderClientId = generateId(),
  contentKey = randomEnum(RegisterInternalKey) as ContentKey,
  sentAt = fakerDate.recent(20),
  triggersAt = fakerDate.recent(20),
  correlationId = generateId(),
  serviceName = ServiceName.hepius,
  type = InnerQueueTypes.createDispatch,
}: Partial<Dispatch> = {}): Dispatch => {
  return {
    dispatchId,
    notificationType,
    recipientClientId,
    senderClientId,
    contentKey,
    sentAt,
    triggersAt,
    correlationId,
    serviceName,
    type,
  };
};

/**************************************************************************************************
 ********************************************* Org ************************************************
 *************************************************************************************************/

export const mockGenerateOrg = ({
  id = generateId(),
  type = OrgType.hospital,
  name = company.companyName(),
  trialDuration = datatype.number(),
  zipCode = fakerAddress.zipCode(),
}: Partial<Org> = {}): Org => {
  return {
    id,
    type,
    name,
    trialDuration,
    zipCode,
  };
};

export const generateOrgParams = ({
  type = OrgType.hospital,
  name = `${lorem.word()}.${v4()}`,
  trialDuration = datatype.number({ min: 1, max: 100 }),
  zipCode = generateZipCode(),
  code,
}: Partial<CreateOrgParams> = {}): CreateOrgParams => {
  return { type, name, trialDuration: trialDuration, zipCode, code: code || name };
};

/**************************************************************************************************
 ***************************************** Appointment ********************************************
 *************************************************************************************************/

export const generateRequestAppointmentParams = ({
  userId = generateId(),
  memberId = generateId(),
  journeyId,
  notBefore = fakerDate.soon(3),
}: Partial<RequestAppointmentParams> = {}): RequestAppointmentParams => {
  return { userId, memberId, journeyId, notBefore };
};

export const generateScheduleAppointmentParams = ({
  id,
  userId = generateId(),
  memberId = generateId(),
  journeyId,
  method = AppointmentMethod.chat,
  start = fakerDate.soon(4),
  end,
}: Partial<ScheduleAppointmentParams> = {}): ScheduleAppointmentParams => {
  const endNew = new Date(start);
  endNew.setHours(endNew.getHours() + 2);
  return { id, userId, memberId, journeyId, method, start, end: end || endNew };
};

export const generateEndAppointmentParams = ({
  id = generateId(),
  noShow = true,
  noShowReason = lorem.sentence(),
  notes = generateNotesParams(),
}: Partial<EndAppointmentParams> = {}): EndAppointmentParams => {
  return { id, noShow, noShowReason, notes };
};

export const generateNotesParams = ({
  recap = lorem.sentence(),
  strengths = lorem.sentence(),
  userActionItem = lorem.sentence(),
  memberActionItem = lorem.sentence(),
  adherence = datatype.number({ min: 1, max: 10 }),
  adherenceText = lorem.sentence(),
  wellbeing = datatype.number({ min: 1, max: 10 }),
  wellbeingText = lorem.sentence(),
}: Partial<Notes & Scores> = {}): Notes => {
  return {
    recap,
    strengths,
    userActionItem,
    memberActionItem,
    scores: {
      adherence,
      adherenceText,
      wellbeing,
      wellbeingText,
    },
  };
};

export const generateUpdateNotesParams = ({
  appointmentId = generateId(),
  notes = generateNotesParams(),
}: Partial<UpdateNotesParams> = {}): UpdateNotesParams => {
  return { appointmentId, notes };
};
export const generateAppointmentLink = (appointmentId: string) => `${hosts.app}/${appointmentId}`;

/**************************************************************************************************
 ****************************************** Availability ******************************************
 *************************************************************************************************/

export const generateAvailabilityInput = ({
  start = fakerDate.soon(),
  end,
}: Partial<AvailabilityInput> = {}): AvailabilityInput => {
  const endNew = new Date(start);
  endNew.setHours(endNew.getHours() + 5);
  return { start, end: end || endNew };
};

/**************************************************************************************************
 *************************************** Communication ********************************************
 *************************************************************************************************/

export const generateCommunication = ({
  userId = v4(),
  memberId = v4(),
  sendBirdChannelUrl = datatype.uuid(),
}: Partial<Communication> = {}): Communication => {
  return { memberId, userId, sendBirdChannelUrl };
};

export const generateGetCommunicationParams = ({
  userId = generateId(),
  memberId = generateId(),
}: Partial<GetCommunicationParams> = {}): GetCommunicationParams => {
  return { userId, memberId };
};

/**************************************************************************************************
 ****************************************** Recordings ********************************************
 *************************************************************************************************/

export const mockGenerateRecording = ({
  id = v4(),
  memberId = generateObjectId(),
  journeyId = generateObjectId(),
  userId = generateObjectId(),
  start = fakerDate.recent(1),
  end = new Date(),
  answered = true,
  phone = generatePhone(),
  recordingType = RecordingType.phone,
  appointmentId = generateObjectId(),
  consent = true,
  identityVerification = true,
  review = {
    userId: generateObjectId(),
    content: lorem.words(5),
    createdAt: new Date(),
    updatedAt: new Date(),
  },
}: Partial<Recording> = {}): Recording => {
  return {
    id,
    memberId,
    journeyId,
    userId,
    start,
    end,
    answered,
    phone,
    recordingType,
    appointmentId,
    consent,
    identityVerification,
    review,
  };
};

export const generateUpdateRecordingParams = ({
  id,
  memberId = generateId(),
  userId = generateId(),
  start = fakerDate.soon(1),
  end = fakerDate.soon(2),
  answered = true,
  phone = generatePhone(),
  appointmentId = generateId(),
  recordingType = RecordingType.phone,
  consent = true,
  identityVerification = true,
  journeyId,
}: Partial<UpdateRecordingParams> = {}): UpdateRecordingParams => {
  const obj = id ? { id } : {};
  return {
    ...obj,
    memberId,
    userId,
    start,
    end,
    answered,
    phone,
    appointmentId,
    recordingType,
    consent,
    identityVerification,
    journeyId,
  };
};

export const generateUpdateRecordingReviewParams = ({
  recordingId = generateId(),
  content = random.words(5),
  userId = generateId(),
}: Partial<UpdateRecordingReviewParams> = {}): UpdateRecordingReviewParams => {
  return { recordingId, content, userId };
};

export const generateRecordingLinkParams = ({
  id = generateId(),
  memberId = generateId(),
}: Partial<RecordingLinkParams> = {}): RecordingLinkParams => {
  return { id, memberId };
};

export const generateMultipartUploadRecordingLinkParams = ({
  id = generateId(),
  memberId = generateId(),
  partNumber = datatype.number(5),
  uploadId = generateId(),
}: Partial<MultipartUploadRecordingLinkParams> = {}): MultipartUploadRecordingLinkParams => {
  return { id, memberId, partNumber, uploadId };
};

export const generateCompleteMultipartUploadParams = ({
  id = generateId(),
  memberId = generateId(),
  uploadId = generateId(),
}: Partial<CompleteMultipartUploadParams> = {}): CompleteMultipartUploadParams => {
  return { id, memberId, uploadId };
};

/**************************************************************************************************
 ***************************************** DailyReport ********************************************
 *************************************************************************************************/

export const generateDailyReport = ({
  memberId = generateObjectId(),
  journeyId = generateObjectId(),
  date = reformatDate(fakerDate.recent().toString(), general.dateFormatString),
  categories = [],
  statsOverThreshold = [],
  notificationSent = false,
}: Partial<DailyReport> = {}): DailyReport => {
  return { memberId, journeyId, date, categories, statsOverThreshold, notificationSent };
};

export const generateDailyReportCategoriesInput = ({
  memberId = generateId(),
  journeyId = generateId(),
  date = reformatDate(fakerDate.recent().toString(), general.dateFormatString),
  categories = [],
}: Partial<DailyReportCategoriesInput> = {}): DailyReportCategoriesInput => {
  return { memberId, journeyId, date, categories };
};

/**************************************************************************************************
 ********************************************* Todo ***********************************************
 *************************************************************************************************/

export const mockGenerateTodo = ({
  id = generateId(),
  memberId = generateObjectId(),
  journeyId = generateObjectId(),
  text = lorem.words(5),
  label = TodoLabel.Appointment,
  cronExpressions = ['0 10 * * 6'],
  start = new Date(),
  end = fakerDate.soon(2),
  status = TodoStatus.active,
  createdBy = generateObjectId(),
  updatedBy = generateObjectId(),
}: Partial<Todo> = {}): Todo => {
  return {
    id,
    memberId,
    journeyId,
    text,
    label,
    cronExpressions,
    start,
    end,
    status,
    createdBy,
    updatedBy,
  };
};

export const mockGenerateActionTodo = ({
  id = generateId(),
  memberId = generateObjectId(),
  journeyId = generateObjectId(),
  label = ActionTodoLabel.Explore,
  resource = {
    id: generateId(),
    name: lorem.words(2),
    type: ResourceType.article,
  },
  status = TodoStatus.active,
  createdBy = generateObjectId(),
  updatedBy = generateObjectId(),
}: Partial<Todo> = {}): Todo => {
  return {
    id,
    memberId,
    journeyId,
    label,
    resource,
    status,
    createdBy,
    updatedBy,
  };
};

export const mockGenerateTodoDone = ({
  id = generateId(),
  memberId = generateObjectId(),
  journeyId = generateObjectId(),
  todoId = generateObjectId(),
  done = new Date(),
}: Partial<TodoDone> = {}): TodoDone => {
  return {
    id,
    memberId,
    journeyId,
    todoId,
    done,
  };
};

export const generateCreateTodoParams = ({
  memberId,
  text = lorem.words(5),
  label = TodoLabel.Appointment,
  cronExpressions = ['0 10 * * 6'],
  start = new Date(),
  end = fakerDate.soon(2),
  journeyId,
}: Partial<CreateTodoParams> = {}): CreateTodoParams => {
  return {
    memberId,
    text,
    label,
    cronExpressions,
    start,
    end,
    journeyId,
  };
};

export const generateCreateActionTodoParams = ({
  memberId,
  label = ActionTodoLabel.Explore,
  resource = {
    id: generateId(),
    name: lorem.words(2),
    type: ResourceType.article,
  },
  journeyId,
}: Partial<CreateActionTodoParams> = {}): CreateActionTodoParams => {
  return {
    memberId,
    label,
    resource,
    journeyId,
  };
};

export const generateGetTodoDonesParams = ({
  start = sub(new Date(), { days: 7 }),
  end = add(new Date(), { days: 7 }),
  memberId,
  journeyId,
}: Partial<GetTodoDonesParams> = {}): GetTodoDonesParams => {
  return {
    start,
    end,
    memberId,
    journeyId,
  };
};

export const generateUpdateTodoParams = ({
  id = generateId(),
  memberId,
  text = lorem.words(5),
  label = TodoLabel.Meds,
  cronExpressions = ['0 10,17,21,23 * * *'],
  start = fakerDate.soon(1),
  end = add(fakerDate.soon(3), { days: 1 }),
  journeyId,
}: Partial<UpdateTodoParams> = {}): UpdateTodoParams => {
  return {
    id,
    memberId,
    text,
    label,
    cronExpressions,
    start,
    end,
    journeyId,
  };
};

export const generateCreateTodoDoneParams = ({
  todoId = generateId(),
  done = new Date(),
  memberId = generateId(),
  journeyId,
}: Partial<CreateTodoDoneParams> = {}): CreateTodoDoneParams => {
  return {
    todoId,
    done,
    memberId,
    journeyId,
  };
};

/**************************************************************************************************
 ************************************ MobileVersion ***********************************************
 *************************************************************************************************/

export const generateCreateMobileVersionParams = ({
  version = generateMobileVersion(),
  platform = Platform.android,
  minVersion,
}: Partial<CreateMobileVersionParams> = {}): CreateMobileVersionParams => {
  return { version, platform, minVersion };
};

export const generateUpdateMinMobileVersionParams = ({
  version = generateMobileVersion(),
  platform = Platform.android,
}: Partial<UpdateMinMobileVersionParams> = {}): UpdateMinMobileVersionParams => {
  return { version, platform };
};

export const generateUpdateFaultyMobileVersionsParams = ({
  versions = [generateMobileVersion(), generateMobileVersion(), generateMobileVersion()],
  platform = Platform.android,
}: Partial<UpdateFaultyMobileVersionsParams> = {}): UpdateFaultyMobileVersionsParams => {
  return { versions, platform };
};

export const generateCheckMobileVersionParams = ({
  version = generateMobileVersion(),
  platform = Platform.android,
  build = generateMobileVersion(),
}: Partial<CheckMobileVersionParams> = {}): CheckMobileVersionParams => {
  return { version, platform, build };
};
export const mockGenerateCheckMobileVersionResponse = ({
  latestVersion = generateMobileVersion(),
  forceUpdate = false,
  updateAvailable = false,
}: Partial<CheckMobileVersionResponse> = {}): CheckMobileVersionResponse => {
  return { latestVersion, forceUpdate, updateAvailable };
};

export const mockGenerateMobileVersion = ({
  version = generateMobileVersion(),
  platform = Platform.android,
  minVersion = false,
  faultyVersion = false,
}: Partial<MobileVersion> = {}): MobileVersion => {
  return { version, platform, minVersion, faultyVersion };
};

export const generateMobileVersion = () =>
  `${datatype.number(99)}.${datatype.number(99)}.${datatype.number(99)}`;

/**************************************************************************************************
 **************************************** Questionnaire *******************************************
 *************************************************************************************************/

export const mockGenerateQuestionnaireItem = ({
  code = datatype.uuid(),
  label = lorem.words(5),
  type = ItemType[randomEnum(ItemType)],
  order = 1,
  required = true,
  options = type === ItemType.choice
    ? [
        { label: lorem.words(3), value: 0 },
        { label: lorem.words(3), value: 1 },
      ]
    : null,
  items = type === ItemType.group
    ? [1, 2].map((order) => mockGenerateQuestionnaireItem({ order }))
    : null,
  range = type === ItemType.range
    ? {
        min: { value: 0, label: lorem.words(3) },
        max: {
          value: datatype.number({ min: 1, max: 10 }),
          label: lorem.words(3),
        },
      }
    : null,
  alertCondition,
}: Partial<Item> = {}): Item => ({
  code,
  label,
  type,
  order,
  required,
  options,
  range,
  items,
  alertCondition,
});

export const mockGenerateQuestionnaireAnswer = ({
  code = lorem.word(),
  value = datatype.number({ min: 0, max: 3 }).toString(),
}: Partial<Answer> = {}): Answer => {
  return {
    code,
    value,
  };
};

export const mockGenerateQuestionnaire = ({
  id = generateId(),
  name = lorem.words(3),
  shortName = lorem.word(3),
  type = QuestionnaireType[randomEnum(QuestionnaireType)],
  active = true,
  items = [1, 2].map((order) => mockGenerateQuestionnaireItem({ order })),
  severityLevels = [
    { min: 0, max: 4, label: 'severity 1' },
    { min: 5, max: 6, label: 'severity 2' },
  ],
  createdBy = generateObjectId(),
}: Partial<Questionnaire> = {}): Questionnaire => {
  const isAssignableToMember = getIsAssignableToMember(type);
  return {
    id,
    name,
    shortName,
    type,
    active,
    items,
    isAssignableToMember,
    severityLevels,
    createdBy,
  };
};

export const generateCreateQuestionnaireParams = ({
  name = lorem.words(3),
  shortName = lorem.word(3),
  type = QuestionnaireType[randomEnum(QuestionnaireType)],
  items = [1, 2].map((order) => mockGenerateQuestionnaireItem({ order })),
  severityLevels = [
    { min: 0, max: 4, label: 'severity 1' },
    { min: 5, max: 6, label: 'severity 2' },
  ],
  notificationScoreThreshold,
  scoreFactor,
}: Partial<CreateQuestionnaireParams> = {}): CreateQuestionnaireParams => {
  const isAssignableToMember = getIsAssignableToMember(type);
  return {
    name,
    shortName,
    type,
    items,
    isAssignableToMember,
    severityLevels,
    notificationScoreThreshold,
    scoreFactor,
  };
};

export const generateSubmitQuestionnaireResponseParams = ({
  questionnaireId = generateId(),
  memberId = generateId(),
  answers = [mockGenerateQuestionnaireAnswer(), mockGenerateQuestionnaireAnswer()],
  relatedEntity,
}: Partial<SubmitQuestionnaireResponseParams> = {}): SubmitQuestionnaireResponseParams => {
  return {
    questionnaireId,
    memberId,
    answers,
    relatedEntity,
  };
};

export const mockGenerateQuestionnaireResponse = ({
  id = generateId(),
  questionnaireId = generateObjectId(),
  memberId = generateObjectId(),
  journeyId = generateObjectId(),
  answers = [mockGenerateQuestionnaireAnswer(), mockGenerateQuestionnaireAnswer()],
  createdAt = new Date(),
  createdBy = generateObjectId(),
}: Partial<QuestionnaireResponse> = {}): QuestionnaireResponse => {
  return {
    id,
    questionnaireId,
    memberId,
    journeyId,
    answers,
    createdAt,
    createdBy,
  };
};
export const generateRequestHeaders = (authId: string) => {
  return { Authorization: sign({ sub: authId }, 'secret') };
};

export function getIsAssignableToMember(questionnaireType: QuestionnaireType): boolean {
  return (
    questionnaireType === QuestionnaireType.phq9 ||
    questionnaireType === QuestionnaireType.gad7 ||
    questionnaireType === QuestionnaireType.who5
  );
}

/**************************************************************************************************
 ***************************************** ActionItem *********************************************
 *************************************************************************************************/
export const mockGenerateActionItem = ({
  id = generateId(),
  memberId = generateObjectId(),
  journeyId = generateObjectId(),
  appointmentId = generateObjectId(),
  title = lorem.words(2),
  description = lorem.words(2),
  category = randomEnum(ActionItemCategory) as ActionItemCategory,
  status = randomEnum(ActionItemStatus) as ActionItemStatus,
  priority = randomEnum(ActionItemPriority) as ActionItemPriority,
  rejectNote = lorem.words(2),
  deadline = fakerDate.soon(3),
  relatedEntities = [],
  createdAt = new Date(),
  createdBy = generateObjectId(),
  updatedBy = generateObjectId(),
}: Partial<ActionItem> = {}): ActionItem => {
  return {
    id,
    title,
    memberId,
    journeyId,
    appointmentId,
    deadline,
    description,
    category,
    status,
    priority,
    rejectNote,
    relatedEntities,
    createdAt,
    createdBy,
    updatedBy,
  };
};

export const generateCreateOrSetActionItemParams = ({
  id,
  memberId = generateId(),
  appointmentId = generateId(),
  title = lorem.words(2),
  description = lorem.words(2),
  category = randomEnum(ActionItemCategory) as ActionItemCategory,
  status = randomEnum(ActionItemStatus) as ActionItemStatus,
  priority = randomEnum(ActionItemPriority) as ActionItemPriority,
  rejectNote = lorem.words(2),
  deadline = fakerDate.soon(3),
  relatedEntities = [],
  link = generateActionItemLink(),
}: Partial<CreateOrSetActionItemParams> = {}): CreateOrSetActionItemParams => {
  return {
    id,
    title,
    memberId,
    appointmentId,
    deadline,
    description,
    category,
    status,
    priority,
    rejectNote,
    relatedEntities,
    link,
  };
};

export const generateActionItemLink = ({
  type = randomEnum(ActionItemLinkType) as ActionItemLinkType,
  value = internet.url(),
}: Partial<ActionItemLink> = {}): ActionItemLink => {
  return {
    type,
    value,
  };
};

/**************************************************************************************************
 ******************************************* Alert ************************************************
 *************************************************************************************************/

export const mockGenerateAlert = ({
  memberId = generateId(),
  type = randomEnum(AlertType) as AlertType,
  date = fakerDate.past(),
  isNew = false,
  dismissed = false,
  text = lorem.sentence(),
}: Partial<Alert> = {}): Alert => {
  return {
    id: `${generateId()}_${type}`,
    date,
    type,
    text,
    memberId,
    isNew,
    dismissed,
  };
};

/**************************************************************************************************
 ****************************************** Admission *********************************************
 *************************************************************************************************/
export const generateAdmissionDiagnosisParams = ({
  changeType,
  id,
  code,
  description,
  primaryType,
  secondaryType,
  clinicalStatus,
  severity,
  onsetStart,
  onsetEnd,
}: {
  changeType: ChangeType;
  id?: string;
  code?: string;
  description?: string;
  primaryType?: PrimaryDiagnosisType;
  secondaryType?: SecondaryDiagnosisType;
  clinicalStatus?: ClinicalStatus;
  severity?: DiagnosisSeverity;
  onsetStart?: string;
  onsetEnd?: string;
}): ChangeAdmissionDiagnosisParams => {
  const attachIdParam = id ? { id } : {};
  return {
    changeType,
    ...attachIdParam,
    code: code || datatype.uuid(),
    description: description || lorem.sentence(),
    primaryType: primaryType || PrimaryDiagnosisType.self,
    secondaryType: secondaryType || SecondaryDiagnosisType.radiology,
    clinicalStatus: clinicalStatus || ClinicalStatus.inactive,
    severity: severity || DiagnosisSeverity.mild,
    onsetStart: onsetStart || generateDateOnly(subDays(new Date(), 2)),
    onsetEnd: onsetEnd || generateDateOnly(subDays(new Date(), 1)),
  };
};

export const generateAdmissionTreatmentRenderedParams = ({
  changeType,
  id,
  startDate,
  endDate,
}: {
  changeType: ChangeType;
  id?: string;
  startDate?: string;
  endDate?: string;
}): ChangeAdmissionTreatmentRenderedParams => {
  const attachIdParam = id ? { id } : {};
  return {
    changeType,
    ...attachIdParam,
    code: v4(),
    startDate: startDate || generateDateOnly(subDays(new Date(), 2)),
    endDate: endDate || generateDateOnly(subDays(new Date(), 1)),
  };
};

export const generateAdmissionMedicationParams = ({
  changeType,
  id,
}: {
  changeType: ChangeType;
  id?: string;
}): ChangeAdmissionMedicationParams => {
  const attachIdParam = id ? { id } : {};
  return {
    changeType,
    ...attachIdParam,
    status: MedicationStatus.start,
    name: lorem.word(),
    rxNorm: lorem.word(),
    route: lorem.word(),
    dosage: lorem.word(),
    frequency: lorem.word(),
    startDate: generateDateOnly(subDays(new Date(), 2)),
    endDate: generateDateOnly(subDays(new Date(), 1)),
    specialInstructions: lorem.sentences(),
  };
};

export const generateAdmissionExternalAppointmentParams = ({
  changeType,
  id,
}: {
  changeType: ChangeType;
  id?: string;
}): ChangeAdmissionExternalAppointmentParams => {
  const attachIdParam = id ? { id } : {};
  return {
    changeType,
    ...attachIdParam,
    status: ExternalAppointmentStatus.scheduled,
    drName: `dr ${name.lastName()}`,
    clinic: lorem.word(),
    date: new Date(),
    type: ExternalAppointmentType.cardiac,
    specialInstructions: lorem.sentences(),
    fullAddress: lorem.sentence(),
    phone: generatePhone(),
    fax: generatePhone(),
  };
};

export const generateAdmissionActivityParams = (): Activity => ({
  general: [lorem.word(), lorem.word()],
  lifting: [lorem.word(), lorem.word()],
  showerOrBathing: [lorem.word()],
  stairs: [lorem.word(), lorem.word()],
  driving: [lorem.word()],
  sexualActivity: [lorem.word()],
  work: [lorem.word()],
});

export const generateAdmissionWoundCareParams = (): WoundCare => ({
  general: [lorem.word(), lorem.word()],
});

export const generateAdmissionDietaryParams = ({
  changeType,
  id,
}: {
  changeType: ChangeType;
  id?: string;
}): ChangeAdmissionDietaryParams => {
  const attachIdParam = id ? { id } : {};
  return {
    changeType,
    ...attachIdParam,
    category: DietaryCategory.other,
    name: DietaryName.fasting,
    date: generateDateOnly(fakerDate.future(1)),
    notes: lorem.sentence(),
  };
};

export const generateChangeMemberDnaParams = ({
  changeType,
  memberId,
  id,
}: {
  changeType: ChangeType;
  memberId: string;
  id?: string;
}): ChangeMemberDnaParams => {
  const createDiagnosis = generateAdmissionDiagnosisParams({ changeType });
  const createTreatmentRendered = generateAdmissionTreatmentRenderedParams({ changeType });
  const createMedication = generateAdmissionMedicationParams({ changeType });
  const createExternalAppointment = generateAdmissionExternalAppointmentParams({ changeType });
  const createDietary = generateAdmissionDietaryParams({ changeType });
  const idObject = id ? { id } : {};
  return {
    memberId,
    ...idObject,
    diagnosis: createDiagnosis,
    treatmentRendered: createTreatmentRendered,
    medication: createMedication,
    externalAppointment: createExternalAppointment,
    dietary: createDietary,
    admitDate: generateDateOnly(subDays(new Date(), 5)),
    admitType: AdmitType.emergency,
    admitSource: AdmitSource.clinicReferral,
    dischargeDate: generateDateOnly(subDays(new Date(), 2)),
    dischargeTo: DischargeTo.snf,
    facility: lorem.sentence(),
    specialInstructions: lorem.sentences(),
    reasonForAdmission: lorem.sentences(),
    hospitalCourse: lorem.sentences(),
    admissionSummary: lorem.sentences(),
    drg: lorem.word(),
    drgDesc: lorem.sentence(),
    nurseNotes: lorem.sentence(),
    warningSigns: [WarningSigns.confusion],
    activity: generateAdmissionActivityParams(),
    woundCare: generateAdmissionWoundCareParams(),
  };
};

/**************************************************************************************************
 ****************************************** Insurance *********************************************
 *************************************************************************************************/

export const generateAddInsuranceParams = ({
  name = lorem.sentence(),
  type = 'medicare',
  memberId = generateId(),
  startDate = generateDateOnly(fakerDate.past()),
  endDate = generateDateOnly(fakerDate.future()),
}: Partial<AddInsuranceParams> = {}): AddInsuranceParams => {
  return { name, type, memberId, startDate, endDate };
};

/**************************************************************************************************
 ********************************************* Care ***********************************************
 *************************************************************************************************/

export const generateCreateRedFlagParams = ({
  memberId = generateId(),
  type = generateId(),
  notes = lorem.words(4),
}: Partial<CreateRedFlagParams> = {}) => {
  return {
    memberId,
    type,
    notes,
  };
};

export const generateCreateBarrierParams = ({
  memberId = generateId(),
  type,
  notes = lorem.words(4),
  redFlagId,
}: Partial<CreateBarrierParams> = {}) => {
  return {
    memberId,
    type,
    notes,
    redFlagId,
  };
};

export const generateUpdateBarrierParams = ({
  id,
  notes = lorem.words(4),
  status = BarrierStatus.completed,
  type,
}: Partial<UpdateBarrierParams> = {}) => {
  return {
    id,
    notes,
    status,
    type,
  };
};

export const generateUpdateRedFlagParams = ({
  id,
  notes = lorem.words(4),
}: Partial<UpdateRedFlagParams> = {}) => {
  return {
    id,
    notes,
  };
};

export const generateCarePlanTypeInput = ({ id, custom }: Partial<CarePlanTypeInput> = {}) => {
  return {
    id,
    custom,
  };
};

export const generateCreateCarePlanParams = ({
  memberId = generateId(),
  type,
  notes = lorem.words(4),
  barrierId,
  dueDate = fakerDate.soon(2),
}: Partial<CreateCarePlanParams> = {}) => {
  return {
    memberId,
    type,
    notes,
    barrierId,
    dueDate,
  };
};

export const generateUpdateCarePlanParams = ({
  id,
  notes = lorem.words(4),
  status = CarePlanStatus.completed,
  dueDate = fakerDate.soon(3),
  completionNote = lorem.words(4),
}: Partial<UpdateCarePlanParams> = {}) => {
  return {
    id,
    notes,
    status,
    dueDate,
    completionNote,
  };
};

export const generateDeleteCarePlanParams = ({
  id,
  deletionNote = lorem.words(4),
}: Partial<DeleteCarePlanParams> = {}) => {
  return {
    id,
    deletionNote,
  };
};

export const generateSubmitCareWizardParams = ({
  redFlag,
  memberId = generateId(),
}: Partial<SubmitCareWizardParams> = {}) => {
  return {
    redFlag,
    memberId,
  };
};

export const generateCreateRedFlagParamsWizard = ({
  barriers,
  type = generateId(),
  notes = lorem.words(4),
}: Partial<CreateRedFlagParamsWizard> = {}) => {
  return {
    barriers,
    type,
    notes,
  };
};

export const generateCreateBarrierParamsWizard = ({
  carePlans,
  type = generateId(),
  notes = lorem.words(4),
}: Partial<CreateBarrierParamsWizard> = {}) => {
  return {
    carePlans,
    type,
    notes,
  };
};

export const generateCreateCarePlanParamsWizard = ({
  type = generateCarePlanTypeInput({ id: generateId() }),
  notes = lorem.words(4),
  dueDate = fakerDate.soon(2),
}: Partial<BaseCarePlanParams> = {}) => {
  return {
    type,
    notes,
    dueDate,
  };
};

export const mockDbBarrierType = () => {
  return {
    _id: generateObjectId(),
    description: lorem.sentence(),
    domain: BarrierDomain.emotional,
    carePlanTypes: [generateObjectId(), generateObjectId()],
  };
};

export const mockDbBarrier = () => {
  const createdAt = fakerDate.past(1);
  const updatedAt = addDays(createdAt, 1);

  return {
    _id: generateObjectId(),
    memberId: generateObjectId(),
    createdAt,
    updatedAt,
    status: BarrierStatus.active,
    notes: lorem.words(),
    completedAt: updatedAt,
    type: generateObjectId(),
    redFlagId: generateObjectId(),
  };
};

export const mockDbCarePlanType = () => {
  return {
    _id: generateObjectId(),
    description: lorem.sentence(),
    isCustom: false,
  };
};

export const mockDbCarePlan = () => {
  const createdAt = fakerDate.past(1);
  const updatedAt = addDays(createdAt, 1);
  const dueDate = addDays(createdAt, 3);

  return {
    _id: generateObjectId(),
    memberId: generateObjectId(),
    createdAt,
    updatedAt,
    status: CarePlanStatus.active,
    notes: lorem.words(),
    completedAt: updatedAt,
    type: generateObjectId(),
    barrierId: generateObjectId(),
    dueDate,
  };
};

export const mockDbRedFlagType = () => ({
  _id: generateObjectId(),
  description: lorem.sentence(),
});

export const mockDbRedFlag = () => {
  const createdAt = fakerDate.past(1);
  const updatedAt = addDays(createdAt, 1);

  return {
    _id: generateObjectId(),
    memberId: generateObjectId(),
    type: generateObjectId(),
    createdAt,
    updatedAt,
    notes: lorem.sentence(),
  };
};

/**************************************************************************************************
 ******************************************* Journal **********************************************
 *************************************************************************************************/

export const generateUpdateJournalTextParams = ({
  id = generateId(),
  text = lorem.sentence(),
}: Partial<UpdateJournalTextParams> = {}): UpdateJournalTextParams => {
  return { id, text };
};

export const generateGetMemberUploadJournalImageLinkParams = ({
  id = generateId(),
  imageFormat = ImageFormat.png,
}: Partial<GetMemberUploadJournalImageLinkParams> = {}): GetMemberUploadJournalImageLinkParams => {
  return { id, imageFormat };
};

export const generateGetMemberUploadJournalAudioLinkParams = ({
  id = generateId(),
  audioFormat = AudioFormat.mp3,
}: Partial<GetMemberUploadJournalAudioLinkParams> = {}): GetMemberUploadJournalAudioLinkParams => {
  return { id, audioFormat };
};

/**************************************************************************************************
 ******************************************* Helpers **********************************************
 *************************************************************************************************/

export const generateDateOnly = (date: Date): string => format(date, momentFormats.date);
export const generateRandomHeight = () =>
  datatype.number({ min: graphql.validators.height.min, max: graphql.validators.height.max });
export const generateRandomWeight = () =>
  datatype.number({ min: graphql.validators.weight.min, max: graphql.validators.weight.max });
export const generateUniqueUrl = () => `${v4()}.${internet.url()}`;
export const generateRandomName = (length: number): string => lorem.words(length).substr(0, length);

const generateEmail = () => `${new Date().getMilliseconds()}.${internet.email()}`;
const generateHealthPlan = () => datatype.string(10);
