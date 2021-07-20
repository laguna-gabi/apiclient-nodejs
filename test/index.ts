import * as faker from 'faker';
import { connect, disconnect, Types } from 'mongoose';
import * as config from 'config';
import { CreateUserParams, User, UserRole } from '../src/user';
import { CreateMemberParams, Member } from '../src/member';
import {
  AppointmentMethod,
  NoShowParams,
  Note,
  RequestAppointmentParams,
  ScheduleAppointmentParams,
  Scores,
} from '../src/appointment';

export const generateCreateUserParams = ({
  roles = [UserRole.coach],
  firstName = faker.name.firstName(21),
  lastName = faker.name.lastName(21),
  email = generateEmail(),
  photoUrl = faker.image.imageUrl(),
  description = faker.lorem.sentence(),
}: {
  roles?: UserRole[];
  firstName?: string;
  lastName?: string;
  email?: string;
  photoUrl?: string;
  description?: string;
} = {}): CreateUserParams => {
  return { firstName, lastName, email, roles, photoUrl, description };
};

export const mockGenerateUser = (): User => {
  const id = new Types.ObjectId();
  const firstName = faker.name.firstName();
  const lastName = faker.name.lastName();
  return {
    id: id.toString(),
    firstName,
    lastName,
    email: generateEmail(),
    roles: [UserRole.coach],
    photoUrl: faker.image.imageUrl(),
    description: faker.lorem.sentence(),
  };
};

export const generateCreateMemberParams = ({
  phoneNumber = generatePhoneNumber(),
  deviceId = faker.datatype.uuid(),
  firstName = faker.name.firstName(),
  lastName = faker.name.lastName(),
  dateOfBirth = faker.date.past(),
  primaryCoachId,
  usersIds = [],
}: {
  phoneNumber?: string;
  deviceId?: string;
  firstName?: string;
  lastName?: string;
  dateOfBirth?: Date;
  primaryCoachId: string;
  usersIds?: string[];
}): CreateMemberParams => {
  return {
    phoneNumber,
    deviceId,
    firstName,
    lastName,
    dateOfBirth,
    primaryCoachId,
    usersIds,
  };
};

export const mockGenerateMember = (): Member => {
  const id = new Types.ObjectId();
  const firstName = faker.name.firstName();
  const lastName = faker.name.lastName();
  return {
    id: id.toString(),
    phoneNumber: generatePhoneNumber(),
    deviceId: faker.datatype.uuid(),
    firstName,
    lastName,
    dateOfBirth: faker.date.past(),
    primaryCoach: mockGenerateUser(),
    ...generateMemberLinks(firstName, lastName),
    users: [],
  };
};

export const generateMemberLinks = (
  firstName,
  lastName,
): { dischargeNotesLink; dischargeInstructionsLink } => {
  const prefix = `${firstName}_${lastName}`;
  return {
    dischargeNotesLink: `${prefix}_Summary.pdf`,
    dischargeInstructionsLink: `${prefix}_Instructions.pdf`,
  };
};

export const generateRequestAppointmentParams = ({
  userId = new Types.ObjectId().toString(),
  memberId = new Types.ObjectId().toString(),
  notBefore = faker.date.future(1),
}: {
  userId?: string;
  memberId?: string;
  notBefore?: Date;
} = {}): RequestAppointmentParams => {
  return { userId, memberId, notBefore };
};

export const generateScheduleAppointmentParams = ({
  userId = new Types.ObjectId().toString(),
  memberId = new Types.ObjectId().toString(),
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
  id = new Types.ObjectId().toString(),
  noShow = true,
  reason = faker.lorem.sentence(),
}: {
  id?: string;
  noShow?: boolean;
  reason?: string;
} = {}): NoShowParams => {
  return { id, noShow, reason };
};

export const generateNoteParam = (): Note => {
  return { key: faker.lorem.word(), value: faker.lorem.sentence() };
};

export const generateScoresParam = (): Scores => {
  return {
    adherence: faker.datatype.number({ min: 1, max: 10 }),
    adherenceText: faker.lorem.sentence(),
    wellbeing: faker.datatype.number({ min: 1, max: 10 }),
    wellbeingText: faker.lorem.sentence(),
  };
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

export const compareUsers = (user: User, userBase) => {
  expect(user.id).toEqual(userBase._id.toString());
  expect(user.firstName).toEqual(userBase.firstName);
  expect(user.lastName).toEqual(userBase.lastName);
  expect(user.email).toEqual(userBase.email);
  expect(user.roles).toEqual(expect.arrayContaining(userBase.roles));
  expect(user.photoUrl).toEqual(userBase.photoUrl);
};

export const dbConnect = async () => {
  await connect(config.get('db.connection'), {
    useNewUrlParser: true,
  });
};

export const dbDisconnect = async () => {
  await disconnect();
};
