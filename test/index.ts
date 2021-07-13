import * as faker from 'faker';
import * as mongoose from 'mongoose';
import * as config from 'config';
import { ObjectID } from 'bson';
import { CreateUserParams, User, UserRole } from '../src/user';
import { CreateMemberParams, Member } from '../src/member';
import {
  AppointmentMethod,
  CreateAppointmentParams,
  ScheduleAppointmentParams,
  NoShowParams,
} from '../src/appointment';
import { authorizedDeviceId } from './memberAuthorization';

export const generateCreateUserParams = ({
  roles = [UserRole.coach],
  name = faker.name.findName(),
  email = generateEmail(),
  photoUrl = faker.image.imageUrl(),
}: {
  roles?: UserRole[];
  name?: string;
  email?: string;
  photoUrl?: string;
} = {}): CreateUserParams => {
  return { name, email, roles, photoUrl };
};

export const mockGenerateUser = (): User => {
  const id = new ObjectID();
  const name = faker.name.findName();
  return {
    id: id.toString(),
    name,
    email: generateEmail(),
    roles: [UserRole.coach],
    photoUrl: faker.image.imageUrl(),
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
  const id = new ObjectID();
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

export const generateCreateAppointmentParams = ({
  userId = new ObjectID().toString(),
  memberId = new ObjectID().toString(),
  notBefore = faker.date.future(1),
}: {
  userId?: string;
  memberId?: string;
  notBefore?: Date;
} = {}): CreateAppointmentParams => {
  return { userId, memberId, notBefore };
};

export const generateScheduleAppointmentParams = ({
  id = new mongoose.Types.ObjectId().toString(),
  method = AppointmentMethod.chat,
  start = faker.date.future(1),
  end,
}: {
  id?: string;
  method?: AppointmentMethod;
  start?: Date;
  end?: Date;
} = {}): ScheduleAppointmentParams => {
  const endNew = new Date(start);
  endNew.setHours(endNew.getHours() + 2);
  return { id, method, start, end: end || endNew };
};

export const generateNoShowAppointmentParams = ({
  id = new mongoose.Types.ObjectId().toString(),
  noShow = true,
  reason = faker.lorem.sentence(),
}: {
  id?: string;
  noShow?: boolean;
  reason?: string;
} = {}): NoShowParams => {
  return { id, noShow, reason };
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
  await mongoose.connect(config.get('db.connection'), {
    useNewUrlParser: true,
  });
};

export const dbDisconnect = async () => {
  await mongoose.disconnect();
};
