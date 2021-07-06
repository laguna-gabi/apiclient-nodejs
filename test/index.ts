import * as faker from 'faker';
import * as mongoose from 'mongoose';
import * as config from 'config';
import { ObjectID } from 'bson';
import { CreateUserParams, User, UserRole } from '../src/user';
import { CreateMemberParams, Member } from '../src/member';

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
  name = faker.name.findName(),
  dateOfBirth = faker.date.past(),
  primaryCoachId,
  usersIds = [],
}: {
  phoneNumber?: string;
  name?: string;
  dateOfBirth?: Date;
  primaryCoachId: string;
  usersIds?: string[];
}): CreateMemberParams => {
  return {
    phoneNumber,
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
    name: faker.name.findName(),
    dateOfBirth: faker.date.past(),
    primaryCoach: mockGenerateUser(),
    users: [],
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

export const connectToDb = async () => {
  await mongoose.connect(config.get('db.connection'), {
    useNewUrlParser: true,
  });
};
