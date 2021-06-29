import { Coach, CoachRole, CreateCoachParams } from '../src/coach/coach.dto';
import * as faker from 'faker';
import * as mongoose from 'mongoose';
import * as config from 'config';
import { ObjectID } from 'bson';
import { CreateMemberParams, Member } from '../src/member/member.dto';

export const generateCreateCoachParams = (
  role: CoachRole = CoachRole.coach,
): CreateCoachParams => {
  return {
    name: generateFullName(),
    role,
    email: faker.internet.email(),
    photoUrl: faker.image.imageUrl(),
  };
};

export const mockGenerateCoach = (): Coach => {
  const id = new ObjectID();
  return {
    _id: id.toString(),
    name: generateFullName(),
    role: CoachRole.coach,
    email: faker.internet.email(),
  };
};

export const generateCreateMemberParams = (
  primaryCoachId: string,
  coachIds: string[] = [],
): CreateMemberParams => {
  return {
    phoneNumber: faker.phone.phoneNumber(),
    name: generateFullName(),
    primaryCoachId,
    coachIds,
  };
};

export const mockGenerateMember = (): Member => {
  const id = new ObjectID();
  return {
    _id: id.toString(),
    phoneNumber: faker.phone.phoneNumber(),
    name: generateFullName(),
    primaryCoach: mockGenerateCoach(),
    coaches: [],
  };
};

const generateFullName = () => {
  return `${faker.name.firstName()} ${faker.name.lastName()}`;
};

export const connectToDb = async () => {
  await mongoose.connect(config.get('db.connection'), {
    useNewUrlParser: true,
  });
};
