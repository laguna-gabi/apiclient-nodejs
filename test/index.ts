import * as faker from 'faker';
import { Types, connect, disconnect } from 'mongoose';
import * as config from 'config';
import { CreateUserParams, User, UserRole } from '../src/user';
import { CreateMemberParams, Member } from '../src/member';
import {
  AppointmentMethod,
  RequestAppointmentParams,
  ScheduleAppointmentParams,
  NoShowParams,
  Note,
  Scores,
} from '../src/appointment';
import { authorizedDeviceId } from './memberAuthorization';

export const generateCreateUserParams = ({
  roles = [UserRole.coach],
  name = faker.name.findName(),
  email = generateEmail(),
  photoUrl = faker.image.imageUrl(),
  description = faker.lorem.sentence(),
}: {
  roles?: UserRole[];
  name?: string;
  email?: string;
  photoUrl?: string;
  description?: string;
} = {}): CreateUserParams => {
  return { name, email, roles, photoUrl, description };
};

export const mockGenerateUser = (): User => {
  const id = new Types.ObjectId();
  const name = faker.name.findName();
  return {
    id: id.toString(),
    name,
    email: generateEmail(),
    roles: [UserRole.coach],
    photoUrl: faker.image.imageUrl(),
    description: faker.lorem.sentence(),
  };
};

export const generateCreateMemberParams = ({
  phoneNumber = generatePhoneNumber(),
  deviceId = authorizedDeviceId,
  name = faker.name.findName(),
  dateOfBirth = faker.date.past(),
  primaryCoachId,
  usersIds = [],
}: {
  phoneNumber?: string;
  deviceId?: string;
  name?: string;
  dateOfBirth?: Date;
  primaryCoachId: string;
  usersIds?: string[];
}): CreateMemberParams => {
  return {
    phoneNumber,
    deviceId,
    name,
    dateOfBirth,
    primaryCoachId,
    usersIds,
  };
};

export const mockGenerateMember = (): Member => {
  const id = new Types.ObjectId();
  return {
    id: id.toString(),
    phoneNumber: generatePhoneNumber(),
    deviceId: authorizedDeviceId,
    name: faker.name.findName(),
    dateOfBirth: faker.date.past(),
    primaryCoach: mockGenerateUser(),
    users: [],
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

export const dbConnect = async () => {
  await connect(config.get('db.connection'), {
    useNewUrlParser: true,
  });
};

export const dbDisconnect = async () => {
  await disconnect();
};
