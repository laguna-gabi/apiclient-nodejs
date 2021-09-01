import * as faker from 'faker';
import { Types } from 'mongoose';
import { CreateUserParams, defaultUserParams, User, UserRole } from '../src/user';
import {
  AppointmentCompose,
  CreateMemberParams,
  CreateTaskParams,
  defaultMemberParams,
  Honorific,
  Member,
  MemberConfig,
  NotifyParams,
  SetGeneralNotesParams,
  Sex,
  TaskStatus,
  UpdateMemberParams,
  UpdateTaskStatusParams,
} from '../src/member';
import {
  AppointmentMethod,
  EndAppointmentParams,
  Notes,
  RequestAppointmentParams,
  ScheduleAppointmentParams,
  UpdateNotesParams,
} from '../src/appointment';
import { CreateOrgParams, OrgType } from '../src/org';
import { Language, Platform, NotificationType } from '../src/common';
import { lookup } from 'zipcode-to-timezone';
import { AvailabilityInput } from '../src/availability';
import { GetCommunicationParams } from '../src/communication';
import * as config from 'config';
import { format } from 'date-fns';
import { v4 } from 'uuid';
import { GetSlotsParams } from '../src/user/slot.dto';

export const generateCreateUserParams = ({
  id = v4(),
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
}: {
  id?: string;
  roles?: UserRole[];
  firstName?: string;
  lastName?: string;
  email?: string;
  avatar?: string;
  description?: string;
  phone?: string;
  title?: string;
  maxCustomers?: number;
  languages?: Language[];
} = {}): CreateUserParams => {
  return {
    id,
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

export const mockGenerateUser = (): User => {
  const firstName = faker.name.firstName();
  const lastName = faker.name.lastName();
  const _id = v4();
  return {
    id: _id,
    _id,
    firstName,
    lastName,
    email: generateEmail(),
    roles: [UserRole.coach],
    avatar: faker.image.imageUrl(),
    description: faker.lorem.sentence(),
    createdAt: faker.date.past(1),
    phone: generatePhone(),
  };
};

export const generateCreateRawUserParams = (params = undefined) => {
  const newUser = generateCreateUserParams(params);
  newUser['_id'] = newUser.id;
  delete newUser.id;

  return newUser;
};

export const generateGetSlotsParams = ({
  userId = null,
  appointmentId = null,
  notBefore = null,
}: {
  userId?: string;
  appointmentId?: string;
  notBefore?: Date;
} = {}): GetSlotsParams => {
  return {
    userId,
    appointmentId,
    notBefore,
  };
};

export const generateCreateMemberParams = ({
  phone = generatePhone(),
  deviceId = faker.datatype.uuid(),
  firstName = faker.name.firstName(),
  lastName = faker.name.lastName(),
  dateOfBirth = generateDateOnly(faker.date.past()),
  orgId,
  primaryUserId,
  usersIds,
  sex,
  email,
  language,
  zipCode = generateZipCode(),
  dischargeDate,
  honorific,
}: {
  phone?: string;
  deviceId?: string;
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  orgId: string;
  primaryUserId: string;
  usersIds?: string[];
  sex?: Sex;
  email?: string;
  language?: Language;
  zipCode?: string;
  dischargeDate?: string;
  honorific?: Honorific;
}): CreateMemberParams => {
  return {
    phone,
    deviceId,
    firstName,
    lastName,
    dateOfBirth,
    orgId,
    primaryUserId,
    usersIds,
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
    primaryUserId: user.id,
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
  };
};

export const generateUpdateMemberParams = ({
  id = generateId(),
  firstName = faker.name.firstName(),
  lastName = faker.name.lastName(),
  sex = Sex.female,
  email = generateEmail(),
  language = Language.en,
  zipCode = generateZipCode(),
  dischargeDate = generateDateOnly(faker.date.soon(10)),
  fellowName = faker.name.firstName(),
  drgDesc = faker.name.firstName(),
  readmissionRisk = faker.name.firstName(),
  phoneSecondary = generatePhone(),
  admitDate = generateDateOnly(faker.date.soon(1)),
  dateOfBirth = generateDateOnly(faker.date.past()),
  address = {
    street: faker.address.streetName(),
    city: faker.address.city(),
    state: faker.address.state(),
  },
  honorific = Honorific.Dr,
}: {
  id?: string;
  firstName?: string;
  lastName?: string;
  sex?: Sex;
  email?: string;
  language?: Language;
  zipCode?: string;
  dischargeDate?: string;
  fellowName?: string;
  drgDesc?: string;
  readmissionRisk?: string;
  phoneSecondary?: string;
  admitDate?: string;
  dateOfBirth?: string;
  address?: { street?: string; city?: string; state?: string };
  honorific?: Honorific;
} = {}): UpdateMemberParams => {
  return {
    id,
    firstName,
    lastName,
    fellowName,
    sex,
    email,
    language,
    zipCode,
    dischargeDate,
    drgDesc,
    readmissionRisk,
    phoneSecondary,
    admitDate,
    dateOfBirth,
    address,
    honorific,
  };
};

export const mockGenerateMemberConfig = (): MemberConfig => {
  return {
    memberId: generateObjectId(),
    externalUserId: v4(),
    platform: Platform.ios,
    accessToken: generateId(),
  };
};

export const generateCreateTaskParams = ({
  memberId = generateId(),
  title = faker.lorem.words(2),
  deadline = faker.date.soon(3),
}: { memberId?: string; title?: string; deadline?: Date } = {}): CreateTaskParams => {
  return { memberId, title, deadline };
};

export const generateUpdateTaskStatusParams = ({
  id = generateId(),
  status = TaskStatus.reached,
}: { id?: string; status?: TaskStatus } = {}): UpdateTaskStatusParams => {
  return { id, status };
};

export const generateRequestAppointmentParams = ({
  userId = v4(),
  memberId = generateId(),
  notBefore = faker.date.soon(3),
}: {
  userId?: string;
  memberId?: string;
  notBefore?: Date;
} = {}): RequestAppointmentParams => {
  return { userId, memberId, notBefore };
};

export const generateScheduleAppointmentParams = ({
  userId = v4(),
  memberId = generateId(),
  method = AppointmentMethod.chat,
  start = faker.date.soon(4),
  end,
}: {
  userId?: string;
  memberId?: string;
  method?: AppointmentMethod;
  start?: Date;
  end?: Date;
} = {}): ScheduleAppointmentParams => {
  const endNew = new Date(start);
  endNew.setHours(endNew.getHours() + 2);
  return { userId, memberId, method, start, end: end || endNew };
};

export const generateEndAppointmentParams = ({
  id = generateId(),
  noShow = true,
  noShowReason = faker.lorem.sentence(),
  notes = generateNotesParams(),
}: {
  id?: string;
  noShow?: boolean;
  noShowReason?: string;
  notes?: Notes;
} = {}): EndAppointmentParams => {
  return { id, noShow, noShowReason, notes };
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
}: {
  recap?: string;
  strengths?: string;
  userActionItem?: string;
  memberActionItem?: string;
  adherence?: number;
  adherenceText?: string;
  wellbeing?: number;
  wellbeingText?: string;
} = {}): Notes => {
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
}: {
  appointmentId?: string;
  notes?: Notes;
} = {}): UpdateNotesParams => {
  return { appointmentId, notes };
};

export const generateOrgParams = ({
  type = OrgType.hospital,
  name = `${faker.lorem.word()}.${faker.datatype.uuid()}`,
  trialDuration = faker.datatype.number({ min: 1, max: 100 }),
  zipCode = generateZipCode(),
}: {
  type?: OrgType;
  name?: string;
  trialDuration?: number;
  zipCode?: string;
} = {}): CreateOrgParams => {
  return { type, name, trialDuration: trialDuration, zipCode };
};

export const generateAppointmentComposeParams = (): AppointmentCompose => {
  const start = faker.date.soon(5);
  const end = new Date(start);
  end.setHours(end.getHours() + 2);

  return {
    memberId: generateId(),
    memberName: `${faker.name.firstName()} ${faker.name.lastName()}`,
    userId: v4(),
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
  userId = v4(),
  start = faker.date.soon(),
  end,
}: {
  userId?: string;
  start?: Date;
  end?: Date;
} = {}): AvailabilityInput => {
  const endNew = new Date(start);
  endNew.setHours(endNew.getHours() + 5);
  return { userId, start, end: end || endNew };
};

export const generateGetCommunicationParams = ({
  userId = v4(),
  memberId = generateId(),
}: { userId?: string; memberId?: string } = {}): GetCommunicationParams => {
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
}: { memberId?: string; note?: string } = {}): SetGeneralNotesParams => {
  return { memberId, note };
};

export const generateDateOnly = (date: Date): string => {
  return format(date, 'yyyy/MM/dd');
};

export const generateNotifyParams = ({
  userId = v4(),
  memberId = generateId(),
  peerId = v4(),
  type = NotificationType.call,
}: {
  userId?: string;
  memberId?: string;
  peerId?: string;
  type?: NotificationType;
} = {}): NotifyParams => {
  return { userId, memberId, peerId, type };
};

const generateEmail = () => {
  return `${faker.datatype.uuid()}.${faker.internet.email()}`;
};

const generatePhone = () => {
  const random = () => Math.floor(Math.random() * 9) + 1;

  let phone = '+414';
  for (let i = 0; i < 8; i++) {
    phone += random().toString();
  }

  return phone;
};
