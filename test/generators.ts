import {
  CancelNotificationType,
  ClientCategory,
  ExternalKey,
  Honorific,
  IUpdateClientSettings,
  InnerQueueTypes,
  InternalKey,
  Language,
  NotificationType,
  Platform,
  ServiceName,
  generatePhone,
  generateZipCode,
} from '@lagunahealth/pandora';
import * as config from 'config';
import { add, format, sub } from 'date-fns';
import * as faker from 'faker';
import { Types } from 'mongoose';
import { v4 } from 'uuid';
import {
  AppointmentMethod,
  EndAppointmentParams,
  Notes,
  RequestAppointmentParams,
  ScheduleAppointmentParams,
  Scores,
  UpdateNotesParams,
} from '../src/appointment';
import { AvailabilityInput } from '../src/availability';
import { MemberRole, RoleTypes, UserRole, reformatDate } from '../src/common';
import { Communication, GetCommunicationParams } from '../src/communication';
import { DailyReport } from '../src/dailyReport';
import {
  AddCaregiverParams,
  Alert,
  AlertType,
  AppointmentCompose,
  AudioFormat,
  CancelNotifyParams,
  CreateMemberParams,
  CreateTaskParams,
  GetMemberUploadJournalAudioLinkParams,
  GetMemberUploadJournalImageLinkParams,
  ImageFormat,
  InternalCreateMemberParams,
  Member,
  MemberConfig,
  NotifyContentParams,
  NotifyParams,
  ReadmissionRisk,
  Relationship,
  ReplaceUserForMemberParams,
  SetGeneralNotesParams,
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
import { CreateOrgParams, Org, OrgType } from '../src/org';
import { Dispatch } from '../src/services';
import {
  CreateTodoDoneParams,
  CreateTodoParams,
  EndAndCreateTodoParams,
  GetTodoDonesParams,
  Label,
  Todo,
  TodoDone,
  TodoStatus,
} from '../src/todo';
import { CreateUserParams, GetSlotsParams, User, defaultUserParams } from '../src/user';
import {
  BarrierType,
  CareStatus,
  CreateBarrierParams,
  CreateCarePlanParams,
  CreateRedFlagParams,
  RedFlagType,
  UpdateBarrierParams,
  UpdateCarePlanParams,
} from '../src/care';
export const generateCreateUserParams = ({
  authId = v4(),
  roles = [UserRole.coach],
  firstName = faker.name.firstName(21),
  lastName = faker.name.lastName(21),
  email = generateEmail(),
  avatar = faker.image.imageUrl(),
  description = faker.lorem.sentence(),
  phone = generatePhone(),
  title = faker.name.title(),
  maxCustomers = defaultUserParams.maxCustomers,
  languages = [Language.en, Language.es],
}: Partial<CreateUserParams> = {}): CreateUserParams => {
  return {
    authId,
    firstName,
    lastName,
    email,
    roles,
    avatar,
    description,
    phone,
    title,
    maxCustomers,
    languages,
  };
};

export const generateMemberConfig = ({
  memberId = generateObjectId(),
  externalUserId = v4(),
  platform = Platform.ios,
  isPushNotificationsEnabled = true,
  accessToken = generateId(),
  firstLoggedInAt = faker.date.past(2),
  articlesPath = faker.system.directoryPath(),
  language = defaultMemberParams.language,
  updatedAt = faker.date.past(2),
}: Partial<MemberConfig> = {}): MemberConfig => {
  return {
    memberId,
    externalUserId,
    platform,
    accessToken,
    isPushNotificationsEnabled,
    firstLoggedInAt,
    articlesPath,
    language,
    updatedAt,
  };
};

export const mockGenerateUser = (): User => {
  const firstName = faker.name.firstName();
  const lastName = faker.name.lastName();
  return {
    id: generateId(),
    firstName,
    lastName,
    email: generateEmail(),
    roles: [UserRole.coach],
    avatar: faker.image.imageUrl(),
    description: faker.lorem.sentence(),
    createdAt: faker.date.past(1),
    phone: generatePhone(),
    authId: v4(),
    lastMemberAssignedAt: new Date(0),
    lastQueryAlert: faker.date.past(2),
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
  firstName = faker.name.firstName(),
  lastName = faker.name.lastName(),
  dateOfBirth = generateDateOnly(faker.date.past()),
  orgId,
  sex,
  email,
  language,
  zipCode = generateZipCode(),
  dischargeDate,
  honorific = defaultMemberParams.honorific,
  userId,
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
  };
};

export const generateInternalCreateMemberParams = ({
  authId = v4(),
  phone = generatePhone(),
  phoneType = 'mobile',
  firstName = faker.name.firstName(),
  lastName = faker.name.lastName(),
  dateOfBirth = generateDateOnly(faker.date.past()),
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

export const mockGenerateMember = (): Member => {
  const firstName = faker.name.firstName();
  const lastName = faker.name.lastName();
  const user = mockGenerateUser();
  return {
    id: generateId(),
    authId: v4(),
    primaryUserId: generateObjectId(user.id),
    phone: generatePhone(),
    phoneType: 'mobile',
    deviceId: faker.datatype.uuid(),
    firstName,
    lastName,
    dateOfBirth: generateDateOnly(faker.date.past()),
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    org: { _id: generateId(), ...generateOrgParams() },
    users: [user],
    sex: defaultMemberParams.sex,
    createdAt: faker.date.past(1),
    updatedAt: faker.date.past(1),
    honorific: defaultMemberParams.honorific,
    roles: [MemberRole.member],
    race: defaultMemberParams.race,
    ethnicity: defaultMemberParams.ethnicity,
    zipCode: generateZipCode(),
    fellowName: `${faker.name.firstName()} ${faker.name.lastName()}`,
    address: {
      street: faker.address.streetName(),
      city: faker.address.city(),
      state: faker.address.state(),
    },
    nurse_notes: faker.lorem.sentence(),
    general_notes: faker.lorem.sentence(),
  };
};

export const mockGenerateOrg = ({
  id = generateId(),
  type = OrgType.hospital,
  name = faker.company.companyName(),
  trialDuration = faker.datatype.number(),
  zipCode = faker.address.zipCode(),
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
  firstName = faker.name.firstName(),
  lastName = faker.name.lastName(),
  sex = Sex.female,
  email = generateEmail(),
  zipCode = generateZipCode(),
  dischargeDate = generateDateOnly(faker.date.soon(10)),
  fellowName = faker.name.firstName(),
  drgDesc = faker.name.firstName(),
  drg = faker.datatype.number({ min: 1, max: 1000 }).toString(),
  phoneSecondary = generatePhone(),
  admitDate = generateDateOnly(faker.date.soon(1)),
  dateOfBirth = generateDateOnly(faker.date.past()),
  address = {
    street: faker.address.streetName(),
    city: faker.address.city(),
    state: faker.address.state(),
  },
  honorific = Honorific.mr,
  deviceId = faker.datatype.uuid(),
  readmissionRisk = ReadmissionRisk.medium,
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
  };
};

export const mockGenerateMemberConfig = ({
  platform = Platform.ios,
  isPushNotificationsEnabled = true,
}: Partial<MemberConfig> = {}): MemberConfig => {
  return {
    memberId: generateObjectId(),
    externalUserId: v4(),
    platform,
    isPushNotificationsEnabled,
    isRecommendationsEnabled: true,
    isAppointmentsReminderEnabled: true,
    accessToken: generateId(),
    firstLoggedInAt: faker.date.past(2),
    articlesPath: faker.system.directoryPath(),
    language: defaultMemberParams.language,
    updatedAt: faker.date.past(1),
  };
};

export const generateUpdateMemberConfigParams = ({
  memberId = generateId(),
  platform = Platform.web,
  isPushNotificationsEnabled = false,
  isAppointmentsReminderEnabled = false,
  isRecommendationsEnabled = false,
  language = Language.en,
}: Partial<UpdateMemberConfigParams> = {}): UpdateMemberConfigParams => {
  return {
    memberId,
    platform,
    isPushNotificationsEnabled,
    isAppointmentsReminderEnabled,
    isRecommendationsEnabled,
    language,
  };
};

export const generateCreateTaskParams = ({
  memberId = generateId(),
  title = faker.lorem.words(2),
  deadline = faker.date.soon(3),
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
  notBefore = faker.date.soon(3),
}: Partial<RequestAppointmentParams> = {}): RequestAppointmentParams => {
  return { userId, memberId, notBefore };
};

export const generateScheduleAppointmentParams = ({
  id,
  userId = generateId(),
  memberId = generateId(),
  method = AppointmentMethod.chat,
  start = faker.date.soon(4),
  end,
}: Partial<ScheduleAppointmentParams> = {}): ScheduleAppointmentParams => {
  const endNew = new Date(start);
  endNew.setHours(endNew.getHours() + 2);
  return { id, userId, memberId, method, start, end: end || endNew };
};

export const generateEndAppointmentParams = ({
  id = generateId(),
  noShow = true,
  noShowReason = faker.lorem.sentence(),
  notes = generateNotesParams(),
  recordingConsent = true,
}: Partial<EndAppointmentParams> = {}): EndAppointmentParams => {
  return { id, noShow, noShowReason, notes, recordingConsent };
};

export const generateNotesParams = ({
  recap = faker.lorem.sentence(),
  strengths = faker.lorem.sentence(),
  userActionItem = faker.lorem.sentence(),
  memberActionItem = faker.lorem.sentence(),
  adherence = faker.datatype.number({ min: 1, max: 10 }),
  adherenceText = faker.lorem.sentence(),
  wellbeing = faker.datatype.number({ min: 1, max: 10 }),
  wellbeingText = faker.lorem.sentence(),
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
  member = mockGenerateMember(),
  type = randomEnum(AlertType) as AlertType,
  date = faker.date.past(),
  isNew = false,
  dismissed = false,
}: Partial<Alert> = {}): Alert => {
  return {
    id: `${generateId()}_${type}`,
    date,
    type,
    member,
    isNew,
    dismissed,
  };
};

export const mockGenerateDispatch = ({
  dispatchId = generateId(),
  notificationType = randomEnum(NotificationType) as NotificationType,
  recipientClientId = generateId(),
  senderClientId = generateId(),
  contentKey = randomEnum(InternalKey) as InternalKey,
  sentAt = faker.date.recent(20),
  triggersAt = faker.date.recent(20),
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
  name = `${faker.lorem.word()}.${v4()}`,
  trialDuration = faker.datatype.number({ min: 1, max: 100 }),
  zipCode = generateZipCode(),
}: Partial<CreateOrgParams> = {}): CreateOrgParams => {
  return { type, name, trialDuration: trialDuration, zipCode };
};

export const generateAppointmentComposeParams = (): AppointmentCompose => {
  const start = faker.date.soon(5);
  const end = new Date(start);
  end.setHours(end.getHours() + 2);

  return {
    memberId: generateId(),
    memberName: `${faker.name.firstName()} ${faker.name.lastName()}`,
    userId: generateId(),
    userName: `${faker.name.firstName()} ${faker.name.lastName()}`,
    start,
    end,
  };
};

export const generateRandomName = (length: number): string => {
  return faker.lorem.words(length).substr(0, length);
};

export const generateAvailabilityInput = ({
  start = faker.date.soon(),
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
}: Partial<Communication> = {}): Communication => {
  const sendBirdChannelUrl = faker.datatype.uuid();
  return { memberId, userId, sendBirdChannelUrl };
};

export const generateReplaceUserForMemberParams = ({
  userId = generateId(),
  memberId = generateId(),
}: Partial<ReplaceUserForMemberParams> = {}): ReplaceUserForMemberParams => {
  return { userId, memberId };
};

export const generateAppointmentLink = (appointmentId: string) => {
  return `${config.get('hosts.app')}/${appointmentId}`;
};

export const generateObjectId = (id?): Types.ObjectId => {
  return new Types.ObjectId(id);
};

export const generateId = (id?): string => {
  return generateObjectId(id).toString();
};

export const generateSetGeneralNotesParams = ({
  memberId = generateId(),
  note = faker.lorem.sentence(),
  nurseNotes = faker.lorem.sentence(),
}: Partial<SetGeneralNotesParams> = {}): SetGeneralNotesParams => {
  return { memberId, note, nurseNotes };
};

export const generateUpdateJournalTextParams = ({
  id = generateId(),
  text = faker.lorem.sentence(),
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
  return format(date, 'yyyy/MM/dd');
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
}: Partial<NotifyContentParams> = {}): NotifyContentParams => {
  return { userId, memberId, contentKey };
};

export const generateCancelNotifyParams = ({
  memberId = generateId(),
  type = CancelNotificationType.cancelCall,
  metadata = { peerId: v4() },
}: Partial<CancelNotifyParams> = {}): CancelNotifyParams => {
  return { memberId, type, metadata };
};

const generateEmail = () => {
  return `${new Date().getMilliseconds()}.${faker.internet.email()}`;
};

export const generateUniqueUrl = () => {
  return `${v4()}.${faker.internet.url()}`;
};

export const generateUpdateRecordingParams = ({
  id,
  memberId = generateId(),
  userId = generateId(),
  start = faker.date.soon(1),
  end = faker.date.soon(2),
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
  content = faker.random.words(5),
}: Partial<UpdateRecordingReviewParams> = {}): UpdateRecordingReviewParams => {
  return { recordingId, content };
};

export const generateDailyReport = ({
  memberId = generateObjectId(),
  date = reformatDate(faker.date.recent().toString(), config.get('general.dateFormatString')),
  categories = [],
  statsOverThreshold = [],
  notificationSent = false,
}: Partial<DailyReport> = {}): DailyReport => {
  return { memberId, date, categories, statsOverThreshold, notificationSent };
};

export const generateUpdateClientSettings = ({
  member,
  memberConfig,
}: {
  member?: Member;
  memberConfig?: MemberConfig;
}): IUpdateClientSettings => {
  return {
    type: InnerQueueTypes.updateClientSettings,
    id: memberConfig?.memberId?.toString() || member.id.toString(),
    clientCategory: ClientCategory.member,
    phone: member?.phone,
    firstName: member?.firstName,
    lastName: member?.lastName,
    orgName: member?.org?.name,
    honorific: member?.honorific,
    zipCode: member?.zipCode || member?.org?.zipCode,
    language: memberConfig?.language,
    platform: memberConfig?.platform,
    isPushNotificationsEnabled: memberConfig?.isPushNotificationsEnabled,
    isAppointmentsReminderEnabled: memberConfig?.isAppointmentsReminderEnabled,
    isRecommendationsEnabled: memberConfig?.isRecommendationsEnabled,
    externalUserId: memberConfig?.externalUserId,
    firstLoggedInAt: memberConfig?.firstLoggedInAt,
  };
};

export const generateContextUserId = (
  userId: string = generateId(),
  roles: RoleTypes[] = [MemberRole.member],
) => {
  return { req: { user: { _id: userId, roles } } };
};

export const generateAddCaregiverParams = ({
  firstName = faker.name.firstName(),
  lastName = faker.name.lastName(),
  email = faker.internet.email(),
  relationship = Relationship.neighbour,
  phone = '+12133734253',
}: Partial<AddCaregiverParams> = {}): AddCaregiverParams => {
  return { firstName, lastName, email, relationship, phone };
};

export const generateUpdateCaregiverParams = ({
  id = generateId(),
  firstName = faker.name.firstName(),
  lastName = faker.name.lastName(),
  email = faker.internet.email(),
  relationship = Relationship.neighbour,
  phone = '+12133734253',
}: Partial<UpdateCaregiverParams> = {}): UpdateCaregiverParams => {
  return { id, firstName, lastName, email, relationship, phone };
};

export const mockGenerateTodo = ({
  id = generateId(),
  memberId = generateObjectId(),
  text = faker.lorem.words(5),
  label = Label.APPT,
  cronExpressions = ['0 10 * * 6'],
  start = new Date(),
  end = faker.date.soon(2),
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
  text = faker.lorem.words(5),
  label = Label.APPT,
  cronExpressions = ['0 10 * * 6'],
  start = new Date(),
  end = faker.date.soon(2),
  createdBy,
  updatedBy,
}: Partial<CreateTodoParams> = {}) => {
  return {
    memberId,
    text,
    label,
    cronExpressions,
    start,
    end,
    createdBy,
    updatedBy,
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

export const generateEndAndCreateTodoParams = ({
  id = generateId(),
  memberId,
  text = faker.lorem.words(5),
  label = Label.MEDS,
  cronExpressions = ['0 10,17,21,23 * * *'],
  start = new Date(),
  end = faker.date.soon(3),
  updatedBy,
}: Partial<EndAndCreateTodoParams> = {}) => {
  return {
    id,
    memberId,
    text,
    label,
    cronExpressions,
    start,
    end,
    updatedBy,
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
  redFlagType = randomEnum(RedFlagType) as RedFlagType,
  notes = faker.lorem.words(4),
  createdBy,
}: Partial<CreateRedFlagParams> = {}) => {
  return {
    memberId,
    redFlagType,
    notes,
    createdBy,
  };
};

export const generateCreateBarrierParams = ({
  memberId = generateId(),
  barrierType = randomEnum(BarrierType) as BarrierType,
  notes = faker.lorem.words(4),
  redFlagId = generateId(),
  createdBy,
}: Partial<CreateBarrierParams> = {}) => {
  return {
    memberId,
    barrierType,
    notes,
    redFlagId,
    createdBy,
  };
};

export const generateUpdateBarrierParams = ({
  id,
  notes = faker.lorem.words(4),
  status = CareStatus.completed,
}: Partial<UpdateBarrierParams> = {}) => {
  return {
    id,
    notes,
    status,
  };
};

export const generateCreateCarePlanParams = ({
  memberId = generateId(),
  carePlanType,
  notes = faker.lorem.words(4),
  barrierId = generateId(),
  customValue,
  dueDate = faker.date.soon(2),
  createdBy,
}: Partial<CreateCarePlanParams> = {}) => {
  return {
    memberId,
    carePlanType,
    notes,
    barrierId,
    customValue,
    dueDate,
    createdBy,
  };
};

export const generateUpdateCarePlanParams = ({
  id,
  notes = faker.lorem.words(4),
  status = CareStatus.completed,
}: Partial<UpdateCarePlanParams> = {}) => {
  return {
    id,
    notes,
    status,
  };
};

/*************************************************************************************************
 ******************************************** Helpers ********************************************
 ************************************************************************************************/
export function randomEnum<T>(enumType: T): string {
  const enumValues = Object.keys(enumType);
  const randomIndex = Math.floor(Math.random() * enumValues.length);
  return enumValues[randomIndex];
}
