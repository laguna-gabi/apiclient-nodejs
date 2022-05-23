import {
  AppointmentMethod,
  AppointmentStatus,
  BarrierDomain,
  BaseCarePlanParams,
  CarePlanTypeInput,
  CareStatus,
  CreateCarePlanParams,
  MemberRole,
  Notes,
  Relationship,
  RoleTypes,
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
  EndAppointmentParams,
  RequestAppointmentParams,
  ScheduleAppointmentParams,
  UpdateNotesParams,
} from '../src/appointment';
import { AvailabilityInput } from '../src/availability';
import {
  CreateBarrierParams,
  CreateRedFlagParams,
  UpdateBarrierParams,
  UpdateCarePlanParams,
  UpdateRedFlagParams,
} from '../src/care';
import {
  CreateBarrierParamsWizard,
  CreateRedFlagParamsWizard,
  SubmitCareWizardParams,
} from '../src/care/wizard.dto';
import { ChangeType, ItemType, momentFormats, reformatDate } from '../src/common';
import { Communication, GetCommunicationParams } from '../src/communication';
import { DailyReport } from '../src/dailyReport';
import {
  AddCaregiverParams,
  AddInsuranceParams,
  Alert,
  AlertType,
  AppointmentCompose,
  AudioFormat,
  CancelNotifyParams,
  CreateMemberParams,
  CreateTaskParams,
  DeleteDischargeDocumentParams,
  DeleteMemberParams,
  DischargeDocumentType,
  GetMemberUploadJournalAudioLinkParams,
  GetMemberUploadJournalImageLinkParams,
  Honorific,
  ImageFormat,
  InternalCreateMemberParams,
  MaritalStatus,
  Member,
  MemberConfig,
  NotifyContentParams,
  NotifyParams,
  ReplaceMemberOrgParams,
  ReplaceUserForMemberParams,
  Sex,
  TaskStatus,
  UpdateCaregiverParams,
  UpdateJournalTextParams,
  UpdateMemberConfigParams,
  UpdateMemberParams,
  UpdateRecordingParams,
  UpdateRecordingReviewParams,
  UpdateTaskStatusParams,
  defaultMemberParams,
} from '../src/member';
import {
  Activity,
  AdmitSource,
  AdmitType,
  ChangeAdmissionDiagnosisParams,
  ChangeAdmissionDietaryParams,
  ChangeAdmissionExternalAppointmentParams,
  ChangeAdmissionMedicationParams,
  ChangeAdmissionTreatmentRenderedParams,
  ChangeMemberDnaParams,
  ClinicalStatus,
  CreateJourneyParams,
  DiagnosisSeverity,
  DietaryCategory,
  DietaryName,
  DischargeTo,
  ExternalAppointmentStatus,
  ExternalAppointmentType,
  Journey,
  MedicationStatus,
  PrimaryDiagnosisType,
  ReadmissionRisk,
  SecondaryDiagnosisType,
  SetGeneralNotesParams,
  UpdateJourneyParams,
  WarningSigns,
  WoundCare,
} from '../src/journey';
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

export const generateCreateUserParams = ({
  roles = [UserRole.coach],
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
  roles = [UserRole.nurse],
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

export const mockGenerateUser = (): User => {
  const firstName = name.firstName();
  const lastName = name.lastName();
  return {
    id: generateId(),
    firstName,
    lastName,
    email: generateEmail(),
    roles: [UserRole.coach],
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

export const generateGetSlotsParams = ({
  userId = null,
  appointmentId = null,
  notBefore = null,
}: Partial<GetSlotsParams> = {}): GetSlotsParams => {
  return {
    userId,
    appointmentId,
    notBefore,
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
  dischargeDate,
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
    dischargeDate,
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
  orgId,
  sex,
  email,
  language,
  zipCode = generateZipCode(),
  dischargeDate,
  honorific = defaultMemberParams.honorific,
  userId,
}: Partial<InternalCreateMemberParams> & { orgId: string }): InternalCreateMemberParams & {
  orgId: string;
} => {
  return {
    authId,
    phone,
    phoneType,
    firstName,
    lastName,
    dateOfBirth,
    orgId,
    sex,
    email,
    language,
    zipCode,
    dischargeDate,
    honorific,
    userId,
  };
};

export const mockGenerateMember = (primaryUser?: User): Member => {
  const firstName = name.firstName();
  const lastName = name.lastName();
  const user = primaryUser || mockGenerateUser();
  const admitDate = subDays(new Date(), 7);
  const dischargeDate = addDays(admitDate, 2);
  const deceasedDate = addDays(admitDate, 3);
  return {
    id: generateId(),
    authId: v4(),
    primaryUserId: generateObjectId(user.id),
    phone: generatePhone(),
    phoneType: 'mobile',
    deviceId: datatype.uuid(),
    admitDate: generateDateOnly(admitDate),
    dischargeDate: generateDateOnly(dischargeDate),
    firstName,
    lastName,
    dateOfBirth: generateDateOnly(fakerDate.past()),
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    org: { _id: generateId(), ...generateOrgParams() },
    users: [user],
    sex: defaultMemberParams.sex,
    createdAt: fakerDate.past(1),
    updatedAt: fakerDate.past(1),
    honorific: defaultMemberParams.honorific,
    roles: [MemberRole.member],
    race: defaultMemberParams.race,
    maritalStatus: MaritalStatus.single,
    zipCode: generateZipCode(),
    fellowName: generateFellowName(),
    address: {
      street: fakerAddress.streetName(),
      city: fakerAddress.city(),
      state: fakerAddress.state(),
    },
    nurse_notes: lorem.sentence(),
    general_notes: lorem.sentence(),
    deceased: { cause: lorem.sentence(), date: generateDateOnly(deceasedDate) },
  };
};

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

export const generateUpdateMemberParams = ({
  id = generateId(),
  authId = v4(),
  firstName = name.firstName(),
  lastName = name.lastName(),
  sex = Sex.female,
  email = generateEmail(),
  zipCode = generateZipCode(),
  dischargeDate = generateDateOnly(fakerDate.soon(10)),
  fellowName = generateFellowName(),
  drgDesc = name.firstName(),
  drg = datatype.number({ min: 1, max: 1000 }).toString(),
  phoneSecondary = generatePhone(),
  admitDate = generateDateOnly(fakerDate.soon(1)),
  dateOfBirth = generateDateOnly(fakerDate.past()),
  address = {
    street: fakerAddress.streetName(),
    city: fakerAddress.city(),
    state: fakerAddress.state(),
  },
  honorific = Honorific.mr,
  deviceId = datatype.uuid(),
  readmissionRisk = ReadmissionRisk.medium,
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
    fellowName,
    sex,
    email,
    zipCode,
    dischargeDate,
    drgDesc,
    drg,
    phoneSecondary,
    admitDate,
    dateOfBirth,
    address,
    honorific,
    deviceId,
    readmissionRisk,
    healthPlan,
    preferredGenderPronoun,
    maritalStatus,
    deceased,
  };
};

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

export const mockGenerateJourney = ({ memberId }: { memberId: string }): Journey => ({
  id: generateId(),
  memberId: new Types.ObjectId(memberId),
  firstLoggedInAt: fakerDate.past(2),
  lastLoggedInAt: fakerDate.past(1),
  fellowName: generateFellowName(),
  admissions: [],
  readmissionRisk: ReadmissionRisk.low,
  isGraduated: false,
  generalNotes: lorem.sentence(),
  nurseNotes: lorem.sentence(),
});

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

export const generateCreateTaskParams = ({
  memberId = generateId(),
  title = lorem.words(2),
  deadline = fakerDate.soon(3),
}: Partial<CreateTaskParams> = {}): CreateTaskParams => {
  return { memberId, title, deadline };
};

export const generateUpdateTaskStatusParams = ({
  id = generateId(),
  status = TaskStatus.reached,
}: Partial<UpdateTaskStatusParams> = {}): UpdateTaskStatusParams => {
  return { id, status };
};

export const generateRequestAppointmentParams = ({
  userId = generateId(),
  memberId = generateId(),
  notBefore = fakerDate.soon(3),
}: Partial<RequestAppointmentParams> = {}): RequestAppointmentParams => {
  return { userId, memberId, notBefore };
};

export const generateScheduleAppointmentParams = ({
  id,
  userId = generateId(),
  memberId = generateId(),
  method = AppointmentMethod.chat,
  start = fakerDate.soon(4),
  end,
}: Partial<ScheduleAppointmentParams> = {}): ScheduleAppointmentParams => {
  const endNew = new Date(start);
  endNew.setHours(endNew.getHours() + 2);
  return { id, userId, memberId, method, start, end: end || endNew };
};

export const generateEndAppointmentParams = ({
  id = generateId(),
  noShow = true,
  noShowReason = lorem.sentence(),
  notes = generateNotesParams(),
  recordingConsent = true,
}: Partial<EndAppointmentParams> = {}): EndAppointmentParams => {
  return { id, noShow, noShowReason, notes, recordingConsent };
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

export const generateUpdateNotesParams = ({
  appointmentId = generateId(),
  notes = generateNotesParams(),
}: Partial<UpdateNotesParams> = {}): UpdateNotesParams => {
  return { appointmentId, notes };
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

export const generateRandomName = (length: number): string => {
  return lorem.words(length).substr(0, length);
};

export const generateAvailabilityInput = ({
  start = fakerDate.soon(),
  end,
}: Partial<AvailabilityInput> = {}): AvailabilityInput => {
  const endNew = new Date(start);
  endNew.setHours(endNew.getHours() + 5);
  return { start, end: end || endNew };
};

export const generateGetCommunicationParams = ({
  userId = generateId(),
  memberId = generateId(),
}: Partial<GetCommunicationParams> = {}): GetCommunicationParams => {
  return { userId, memberId };
};

export const generateCommunication = ({
  userId = v4(),
  memberId = v4(),
  sendBirdChannelUrl = datatype.uuid(),
}: Partial<Communication> = {}): Communication => {
  return { memberId, userId, sendBirdChannelUrl };
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

export const generateDeleteDischargeDocumentParams = ({
  memberId = generateId(),
  dischargeDocumentType = DischargeDocumentType.Instructions,
}: // eslint-disable-next-line max-len
Partial<DeleteDischargeDocumentParams> = {}): DeleteDischargeDocumentParams => {
  return { memberId, dischargeDocumentType };
};

export const generateAppointmentLink = (appointmentId: string) => {
  return `${hosts.app}/${appointmentId}`;
};

export const generateSetGeneralNotesParams = ({
  memberId = generateId(),
  note = lorem.sentence(),
  nurseNotes = lorem.sentence(),
}: Partial<SetGeneralNotesParams> = {}): SetGeneralNotesParams => {
  return { memberId, note, nurseNotes };
};

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

export const generateDateOnly = (date: Date): string => {
  return format(date, momentFormats.date);
};

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

const generateEmail = () => {
  return `${new Date().getMilliseconds()}.${internet.email()}`;
};

export const generateUniqueUrl = () => {
  return `${v4()}.${internet.url()}`;
};

export const generateUpdateRecordingParams = ({
  id,
  memberId = generateId(),
  userId = generateId(),
  start = fakerDate.soon(1),
  end = fakerDate.soon(2),
  answered = true,
  phone = generatePhone(),
  appointmentId,
  recordingType,
}: Partial<UpdateRecordingParams> = {}): UpdateRecordingParams => {
  const obj = id ? { id } : {};
  return { ...obj, memberId, userId, start, end, answered, phone, appointmentId, recordingType };
};

export const generateUpdateRecordingReviewParams = ({
  recordingId = generateId(),
  content = random.words(5),
}: Partial<UpdateRecordingReviewParams> = {}): UpdateRecordingReviewParams => {
  return { recordingId, content };
};

export const generateDailyReport = ({
  memberId = generateObjectId(),
  date = reformatDate(fakerDate.recent().toString(), general.dateFormatString),
  categories = [],
  statsOverThreshold = [],
  notificationSent = false,
}: Partial<DailyReport> = {}): DailyReport => {
  return { memberId, date, categories, statsOverThreshold, notificationSent };
};

export const generateUpdateClientSettings = ({
  member,
  memberConfig,
  journey,
}: {
  member?: Member;
  memberConfig?: MemberConfig;
  journey?: Journey;
}): IUpdateClientSettings => {
  return {
    type: InnerQueueTypes.updateClientSettings,
    id: memberConfig?.memberId?.toString() || member.id.toString(),
    clientCategory: ClientCategory.member,
    phone: member?.phone,
    firstName: member?.firstName,
    lastName: member?.lastName,
    orgName: member?.org?.name,
    zipCode: member?.zipCode || member?.org?.zipCode,
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

export const generateContextUserId = (
  userId: string = generateId(),
  roles: RoleTypes[] = [MemberRole.member],
) => {
  return { req: { user: { _id: userId, roles } } };
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

export const mockGenerateTodo = ({
  id = generateId(),
  memberId = generateObjectId(),
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
  todoId = generateObjectId(),
  done = new Date(),
}: Partial<TodoDone> = {}): TodoDone => {
  return {
    id,
    memberId,
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
}: Partial<CreateTodoParams> = {}) => {
  return {
    memberId,
    text,
    label,
    cronExpressions,
    start,
    end,
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
}: Partial<CreateActionTodoParams> = {}) => {
  return {
    memberId,
    label,
    resource,
  };
};

export const generateGetTodoDonesParams = ({
  start = sub(new Date(), { days: 7 }),
  end = add(new Date(), { days: 7 }),
  memberId,
}: Partial<GetTodoDonesParams> = {}) => {
  return {
    start,
    end,
    memberId,
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
}: Partial<UpdateTodoParams> = {}) => {
  return {
    id,
    memberId,
    text,
    label,
    cronExpressions,
    start,
    end,
  };
};

export const generateCreateTodoDoneParams = ({
  todoId = generateId(),
  done = new Date(),
  memberId = generateId(),
}: Partial<CreateTodoDoneParams> = {}) => {
  return {
    todoId,
    done,
    memberId,
  };
};

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
  status = CareStatus.completed,
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
  status = CareStatus.completed,
  dueDate = fakerDate.soon(3),
}: Partial<UpdateCarePlanParams> = {}) => {
  return {
    id,
    notes,
    status,
    dueDate,
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
    status: CareStatus.active,
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
    status: CareStatus.active,
    notes: lorem.words(),
    completedAt: updatedAt,
    type: generateObjectId(),
    barrierId: generateObjectId(),
    dueDate,
  };
};

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
        max: { value: datatype.number({ min: 1, max: 10 }), label: lorem.words(3) },
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

export const generateSubmitQuestionnaireResponseParams = ({
  questionnaireId = generateId(),
  memberId = generateId(),
  answers = [mockGenerateQuestionnaireAnswer(), mockGenerateQuestionnaireAnswer()],
}: Partial<SubmitQuestionnaireResponseParams> = {}): SubmitQuestionnaireResponseParams => {
  return {
    questionnaireId,
    memberId,
    answers,
  };
};

export const mockGenerateQuestionnaireResponse = ({
  id = generateId(),
  questionnaireId = generateObjectId(),
  memberId = generateObjectId(),
  answers = [mockGenerateQuestionnaireAnswer(), mockGenerateQuestionnaireAnswer()],
  createdAt = new Date(),
  createdBy = generateObjectId(),
}: Partial<QuestionnaireResponse> = {}): QuestionnaireResponse => {
  return {
    id,
    questionnaireId,
    memberId,
    answers,
    createdAt,
    createdBy,
  };
};
export const generateRequestHeaders = (authId: string) => {
  return { Authorization: sign({ sub: authId }, 'secret') };
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

/*************************************************************************************************
 ******************************************** Journey ********************************************
 ************************************************************************************************/
export const generateCreateJourneyParams = ({
  memberId = generateId(),
}: Partial<CreateJourneyParams> = {}): CreateJourneyParams => ({
  memberId,
});

export const generateUpdateJourneyParams = ({
  memberId = generateId(),
  fellowName = generateFellowName(),
  readmissionRisk = ReadmissionRisk.low,
}: Partial<UpdateJourneyParams> = {}): UpdateJourneyParams => ({
  memberId,
  fellowName,
  readmissionRisk,
});

/*************************************************************************************************
 ***************************** ChangeMemberDnaParams related methods *****************************
 ************************************************************************************************/
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
    warningSigns: [WarningSigns.confusion],
    activity: generateAdmissionActivityParams(),
    woundCare: generateAdmissionWoundCareParams(),
  };
};

export const generateRandomHeight = () =>
  datatype.number({ min: graphql.validators.height.min, max: graphql.validators.height.max });

export const generateRandomWeight = () =>
  datatype.number({ min: graphql.validators.weight.min, max: graphql.validators.weight.max });

export const generateAddInsuranceParams = ({
  name = lorem.sentence(),
  type = 'medicare',
  memberId = generateId(),
  startDate = generateDateOnly(fakerDate.past()),
  endDate = generateDateOnly(fakerDate.future()),
}: Partial<AddInsuranceParams> = {}): AddInsuranceParams => {
  return { name, type, memberId, startDate, endDate };
};

/*************************************************************************************************
 ******************************************** Helpers ********************************************
 ************************************************************************************************/
export function randomEnum<T>(enumType: T): string {
  const enumValues = Object.keys(enumType);
  const randomIndex = Math.floor(Math.random() * enumValues.length);
  return enumValues[randomIndex];
}

export function getIsAssignableToMember(questionnaireType: QuestionnaireType): boolean {
  return (
    questionnaireType === QuestionnaireType.phq9 ||
    questionnaireType === QuestionnaireType.gad7 ||
    questionnaireType === QuestionnaireType.who5
  );
}

const generateFellowName = () => `${name.firstName()} ${name.lastName()}`;
const generateHealthPlan = () => datatype.string(10);
