import { Coach, CoachRole, CreateCoachParams } from '../src/coach/coach.dto';
import * as faker from 'faker';
import * as mongoose from 'mongoose';
import * as config from 'config';
import { ObjectID } from 'bson';

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

export const generateCoach = (): Coach => {
  const id = new ObjectID();
  return {
    _id: id.toString(),
    name: generateFullName(),
    role: CoachRole.coach,
    email: faker.internet.email(),
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
