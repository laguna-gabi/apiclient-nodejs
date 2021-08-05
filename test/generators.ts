import * as faker from 'faker';
import { Types } from 'mongoose';
import { CreateUserParams, User, UserRole } from '../src/user';
import {
  AppointmentCompose,
  CreateMemberParams,
  CreateTaskParams,
  defaultMemberParams,
  Member,
  Sex,
  TaskState,
  UpdateMemberParams,
  UpdateTaskStateParams,
} from '../src/member';
import {
  AppointmentMethod,
  NoShowParams,
  Notes,
  RequestAppointmentParams,
  ScheduleAppointmentParams,
} from '../src/appointment';
import { CreateOrgParams, OrgType } from '../src/org';
import { Links } from '.';
import { Language } from '../src/common';
import { lookup } from 'zipcode-to-timezone';
import { AvailabilityInput } from '../src/availability';
import { GetCommunicationParams } from '../src/communication';
import * as config from 'config';

export const generateCreateUserParams = ({
  roles = [UserRole.coach],
  firstName = faker.name.firstName(21),
  lastName = faker.name.lastName(21),
  email = generateEmail(),
  avatar = faker.image.imageUrl(),
  description = faker.lorem.sentence(),
  phoneNumber = generatePhoneNumber(),
  title = faker.name.title(),
  maxCustomers = faker.datatype.number({ min: 1, max: 100 }),
  languages = [Language.en, Language.es],
}: {
  roles?: UserRole[];
  firstName?: string;
  lastName?: string;
  email?: string;
  avatar?: string;
  description?: string;
  phoneNumber?: string;
  title?: string;
  maxCustomers?: number;
  languages?: Language[];
} = {}): CreateUserParams => {
  return {
    firstName,
    lastName,
    email,
    roles,
    avatar,
    description,
    phoneNumber,
    title,
    maxCustomers,
    languages,
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
    phoneNumber: generatePhoneNumber(),
  };
};

export const generateCreateMemberParams = ({
  phoneNumber = generatePhoneNumber(),
  deviceId = faker.datatype.uuid(),
  firstName = faker.name.firstName(),
  lastName = faker.name.lastName(),
  dateOfBirth = faker.date.past(),
  primaryCoachId,
  orgId,
  usersIds = [],
  sex,
  email,
  language,
  zipCode = generateZipCode(),
  dischargeDate,
}: {
  phoneNumber?: string;
  deviceId?: string;
  firstName?: string;
  lastName?: string;
  dateOfBirth?: Date;
  primaryCoachId: string;
  orgId: string;
  usersIds?: string[];
  sex?: Sex;
  email?: string;
  language?: Language;
  zipCode?: string;
  dischargeDate?: Date;
}): CreateMemberParams => {
  return {
    phoneNumber,
    deviceId,
    firstName,
    lastName,
    dateOfBirth,
    orgId,
    primaryCoachId,
    usersIds,
    sex,
    email,
    language,
    zipCode,
    dischargeDate,
  };
};

export const mockGenerateMember = (): Member => {
  const firstName = faker.name.firstName();
  const lastName = faker.name.lastName();
  return {
    id: generateId(),
    phoneNumber: generatePhoneNumber(),
    deviceId: faker.datatype.uuid(),
    firstName,
    lastName,
    dateOfBirth: faker.date.past(),
    org: { id: generateId(), ...generateOrgParams() },
    primaryCoach: mockGenerateUser(),
    ...generateMemberLinks(firstName, lastName),
    users: [],
    sex: defaultMemberParams.sex,
    language: defaultMemberParams.language,
    createdAt: faker.date.past(1),
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
  dischargeDate = faker.date.future(1),
  fellowName = faker.name.firstName(),
  drgDesc = faker.name.firstName(),
  readmissionRisk = faker.name.firstName(),
  phoneSecondary = generatePhoneNumber(),
}: {
  id?: string;
  firstName?: string;
  lastName?: string;
  sex?: Sex;
  email?: string;
  language?: Language;
  zipCode?: string;
  dischargeDate?: Date;
  fellowName?: string;
  drgDesc?: string;
  readmissionRisk?: string;
  phoneSecondary?: string;
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
  };
};

export const generateMemberLinks = (firstName, lastName): Links => {
  const prefix = `${firstName}_${lastName}`;
  return {
    dischargeNotesLink: `${prefix}_Summary.pdf`,
    dischargeInstructionsLink: `${prefix}_Instructions.pdf`,
  };
};

export const generateCreateTaskParams = ({
  memberId = generateId(),
  title = faker.lorem.words(2),
  deadline = faker.date.future(1),
}: { memberId?: string; title?: string; deadline?: Date } = {}): CreateTaskParams => {
  return { memberId, title, deadline };
};

export const generateUpdateTaskStateParams = ({
  id = generateId(),
  state = TaskState.reached,
}: { id?: string; state?: TaskState } = {}): UpdateTaskStateParams => {
  return { id, state };
};

export const generateRequestAppointmentParams = ({
  userId = generateId(),
  memberId = generateId(),
  notBefore = faker.date.future(1),
}: {
  userId?: string;
  memberId?: string;
  notBefore?: Date;
} = {}): RequestAppointmentParams => {
  return { userId, memberId, notBefore };
};

export const generateScheduleAppointmentParams = ({
  userId = generateId(),
  memberId = generateId(),
  notBefore = faker.date.future(1),
  method = AppointmentMethod.chat,
  start = faker.date.future(1),
  end,
}: {
  userId?: string;
  memberId?: string;
  notBefore?: Date;
  method?: AppointmentMethod;
  start?: Date;
  end?: Date;
} = {}): ScheduleAppointmentParams => {
  const endNew = new Date(start);
  endNew.setHours(endNew.getHours() + 2);
  return { userId, memberId, notBefore, method, start, end: end || endNew };
};

export const generateNoShowAppointmentParams = ({
  id = generateId(),
  noShow = true,
  reason = faker.lorem.sentence(),
}: {
  id?: string;
  noShow?: boolean;
  reason?: string;
} = {}): NoShowParams => {
  return { id, noShow, reason };
};

export const generateNotesParams = (notesCount = 1): Notes => {
  const notes = Array.from(Array(notesCount)).map(() => ({
    key: faker.lorem.word(),
    value: faker.lorem.sentence(),
  }));

  return {
    notes,
    scores: {
      adherence: faker.datatype.number({ min: 1, max: 10 }),
      adherenceText: faker.lorem.sentence(),
      wellbeing: faker.datatype.number({ min: 1, max: 10 }),
      wellbeingText: faker.lorem.sentence(),
    },
  };
};

export const generateOrgParams = ({
  type = OrgType.hospital,
  name = `${faker.lorem.word()}.${faker.datatype.uuid()}`,
  trialDuration = faker.datatype.number({ min: 1, max: 100 }),
}: {
  type?: OrgType;
  name?: string;
  trialDuration?: number;
} = {}): CreateOrgParams => {
  return { type, name, trialDuration: trialDuration };
};

export const generateAppointmentComposeParams = (): AppointmentCompose => {
  const start = faker.date.future(1);
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
  userId = generateId(),
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
  userId = generateId(),
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

const generateEmail = () => {
  return `${faker.datatype.uuid()}.${faker.internet.email()}`;
};

const generatePhoneNumber = () => {
  const random = () => Math.floor(Math.random() * 9) + 1;

  let phoneNumber = '+414';
  for (let i = 0; i < 8; i++) {
    phoneNumber += random().toString();
  }

  return phoneNumber;
};
