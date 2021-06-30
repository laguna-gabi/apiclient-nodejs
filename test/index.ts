import { User, UserRole, CreateUserParams } from '../src/user/user.schema';
import * as faker from 'faker';
import * as mongoose from 'mongoose';
import * as config from 'config';
import { ObjectID } from 'bson';
import { CreateMemberParams, Member } from '../src/member/member.schema';

export const generateCreateUserParams = (
  role: UserRole = UserRole.coach,
): CreateUserParams => {
  const name = generateFullName();
  return {
    name,
    role,
    email: generateEmail(),
    photoUrl: faker.image.imageUrl(),
  };
};

export const mockGenerateUser = (): User => {
  const id = new ObjectID();
  const name = generateFullName();
  return {
    id: id.toString(),
    name,
    role: UserRole.coach,
    email: generateEmail(),
  };
};

export const generateCreateMemberParams = (
  primaryCoachId: string,
  usersIds: string[] = [],
): CreateMemberParams => {
  return {
    phoneNumber: faker.phone.phoneNumber(),
    name: generateFullName(),
    primaryCoachId,
    usersIds,
  };
};

export const mockGenerateMember = (): Member => {
  const id = new ObjectID();
  return {
    id: id.toString(),
    phoneNumber: faker.phone.phoneNumber(),
    name: generateFullName(),
    primaryCoach: mockGenerateUser(),
    users: [],
  };
};

const generateFullName = () => {
  return `${faker.name.firstName()} ${faker.name.lastName()}`;
};

const generateEmail = () => {
  return `${faker.datatype.uuid()}.${faker.internet.email()}`;
};

export const connectToDb = async () => {
  await mongoose.connect(config.get('db.connection'), {
    useNewUrlParser: true,
  });
};
