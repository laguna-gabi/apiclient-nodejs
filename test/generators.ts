import * as config from 'config';
import { format } from 'date-fns';
import * as faker from 'faker';
import { Types } from 'mongoose';
import { v4 } from 'uuid';
import { lookup } from 'zipcode-to-timezone';
import * as en from '../languages/en.json';
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
import {
  CancelNotificationParams,
  ContentKey,
  InternalNotifyParams,
  Language,
  MemberRole,
  SendOneSignalNotification,
  SendSendBirdNotification,
  SendTwilioNotification,
  UserRole,
} from '../src/common';
import {
  CancelNotificationType,
  InternalNotificationType,
  NotificationType,
  Platform,
} from '@lagunahealth/pandora';
import { Communication, GetCommunicationParams } from '../src/communication';
import {
  AppointmentCompose,
  CancelNotifyParams,
  CreateMemberParams,
  CreateTaskParams,
  Honorific,
  Member,
  MemberConfig,
  NotifyParams,
  ReplaceUserForMemberParams,
  SetGeneralNotesParams,
  Sex,
  TaskStatus,
  UpdateJournalParams,
  UpdateMemberConfigParams,
  UpdateMemberParams,
  UpdateRecordingParams,
  UpdateTaskStatusParams,
  defaultMemberParams,
} from '../src/member';
import { CreateOrgParams, OrgType } from '../src/org';
import { CreateUserParams, GetSlotsParams, User, defaultUserParams } from '../src/user';

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
}: Partial<MemberConfig> = {}): MemberConfig => {
  return {
    memberId,
    externalUserId,
    platform,
    accessToken,
    isPushNotificationsEnabled,
    firstLoggedInAt,
    articlesPath,
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
  honorific,
}: Partial<CreateMemberParams> & { orgId: string }): CreateMemberParams => {
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
    deviceId: faker.datatype.uuid(),
    firstName,
    lastName,
    dateOfBirth: generateDateOnly(faker.date.past()),
    org: { id: generateId(), ...generateOrgParams() },
    users: [user],
    sex: defaultMemberParams.sex,
    language: defaultMemberParams.language,
    createdAt: faker.date.past(1),
    honorific: defaultMemberParams.honorific,
    roles: [MemberRole.member],
  };
};

export const generateUpdateMemberParams = ({
  id = generateId(),
  authId = v4(),
  firstName = faker.name.firstName(),
  lastName = faker.name.lastName(),
  sex = Sex.female,
  email = generateEmail(),
  language = Language.en,
  zipCode = generateZipCode(),
  dischargeDate = generateDateOnly(faker.date.soon(10)),
  fellowName = faker.name.firstName(),
  drgDesc = faker.name.firstName(),
  drg = faker.datatype.number({ min: 1, max: 1000 }).toString(),
  readmissionRisk = faker.name.firstName(),
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
}: Partial<UpdateMemberParams> = {}): UpdateMemberParams => {
  return {
    id,
    authId,
    firstName,
    lastName,
    fellowName,
    sex,
    email,
    language,
    zipCode,
    dischargeDate,
    drgDesc,
    drg,
    readmissionRisk,
    phoneSecondary,
    admitDate,
    dateOfBirth,
    address,
    honorific,
    deviceId,
  };
};

export const mockGenerateMemberConfig = (): MemberConfig => {
  return {
    memberId: generateObjectId(),
    externalUserId: v4(),
    platform: Platform.ios,
    isPushNotificationsEnabled: true,
    accessToken: generateId(),
    firstLoggedInAt: faker.date.past(2),
    articlesPath: faker.system.directoryPath(),
  };
};

export const generateUpdateMemberConfigParams = ({
  memberId = generateId(),
  platform = Platform.web,
  isPushNotificationsEnabled = false,
  isAppointmentsReminderEnabled = false,
  isRecommendationsEnabled = false,
}: Partial<UpdateMemberConfigParams> = {}): UpdateMemberConfigParams => {
  return {
    memberId,
    platform,
    isPushNotificationsEnabled,
    isAppointmentsReminderEnabled,
    isRecommendationsEnabled,
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

export const generateZipCode = (): string => {
  while (true) {
    const zipCode = faker.address.zipCode('#####');
    /**
     * On occasions, faker generates invalid zipcodes. we'll try to generate
     * timezone, if it worked, we'll return the zipCode and exit the loop
     * Usually this works in the 1st time, so rarely we'll do it twice.
     */
    const timeZone = lookup(zipCode);
    if (timeZone) {
      return zipCode;
    }
  }
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

export const generateGetCommunication = () => {
  return {
    memberId: generateId(),
    userId: v4(),
    chat: {
      memberLink: faker.datatype.uuid(),
      userLink: faker.datatype.uuid(),
    },
  };
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

export const generatePath = (type: NotificationType) => {
  return type === NotificationType.call || type === NotificationType.video ? { path: 'call' } : {};
};

export const generateSetGeneralNotesParams = ({
  memberId = generateId(),
  note = faker.lorem.sentence(),
  nurseNotes = faker.lorem.sentence(),
}: Partial<SetGeneralNotesParams> = {}): SetGeneralNotesParams => {
  return { memberId, note, nurseNotes };
};

export const generateUpdateJournalParams = ({
  id = generateId(),
  text = faker.lorem.sentence(),
}: Partial<UpdateJournalParams> = {}): UpdateJournalParams => {
  return { id, text };
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

export const generateCancelNotifyParams = ({
  notificationId = v4(),
  memberId = generateId(),
  type = CancelNotificationType.cancelCall,
  metadata = { peerId: v4() },
}: Partial<CancelNotifyParams> = {}): CancelNotifyParams => {
  return { notificationId, memberId, type, metadata };
};

export const generateCancelNotificationParams = (): CancelNotificationParams => {
  return {
    externalUserId: v4(),
    platform: Platform.ios,
    data: {
      peerId: v4(),
      type: CancelNotificationType.cancelCall,
      notificationId: v4(),
    },
  };
};

export const generateInternalNotifyParams = ({
  memberId = generateId(),
  userId = generateId(),
  type = InternalNotificationType.textToMember,
  metadata = {
    contentType: ContentKey.logReminder,
    sendBirdChannelUrl: generateUniqueUrl(),
  },
  content = en.translation.contents.logReminder,
}: Partial<InternalNotifyParams> = {}): InternalNotifyParams => {
  return { memberId, userId, type, metadata, content };
};

export const generateSendOneSignalNotificationParams = (): SendOneSignalNotification => {
  return {
    platform: Platform.ios,
    externalUserId: v4(),
    data: {
      user: {
        id: faker.datatype.uuid(),
        firstName: faker.name.firstName(),
        avatar: faker.image.avatar(),
      },
      member: { phone: generatePhone() },
      type: NotificationType.text,
      isVideo: false,
    },
    content: faker.lorem.sentence(),
  };
};

export const generateSendTwilioNotificationParams = (): SendTwilioNotification => {
  return {
    body: faker.lorem.sentence(),
    to: faker.phone.phoneNumber(),
  };
};

export const generateSendSendBirdNotificationParams = (
  notificationType,
): SendSendBirdNotification => {
  return {
    userId: v4(),
    sendBirdChannelUrl: generateUniqueUrl(),
    message: faker.lorem.sentence(),
    notificationType,
  };
};

const generateEmail = () => {
  return `${new Date().getMilliseconds()}.${faker.internet.email()}`;
};

export const generatePhone = () => {
  const random = () => Math.floor(Math.random() * 9) + 1;

  let phone = '+414';
  for (let i = 0; i < 8; i++) {
    phone += random().toString();
  }

  return phone;
};

export const generateUniqueUrl = () => {
  return `${v4()}.${faker.internet.url()}`;
};

export const generateUpdateRecordingParams = ({
  id = generateId(),
  memberId = generateId(),
  userId = generateId(),
  start = faker.date.soon(1),
  end = faker.date.soon(2),
  answered = true,
  phone = generatePhone(),
  appointmentId,
  recordingType,
}: Partial<UpdateRecordingParams> = {}): UpdateRecordingParams => {
  return { id, memberId, userId, start, end, answered, phone, appointmentId, recordingType };
};
