import { User } from '../src/user';
import { connect, disconnect } from 'mongoose';
import * as config from 'config';
import { TestingModule } from '@nestjs/testing';
import { SendBird } from '../src/providers';

export interface Links {
  dischargeNotesLink: string;
  dischargeInstructionsLink: string;
}

export const compareUsers = (user: User, userBase) => {
  expect(user.id).toEqual(userBase.id);
  expect(user.firstName).toEqual(userBase.firstName);
  expect(user.lastName).toEqual(userBase.lastName);
  expect(user.email).toEqual(userBase.email);
  expect(user.roles).toEqual(expect.arrayContaining(userBase.roles));
  expect(user.avatar).toEqual(userBase.avatar);
  expect(user.createdAt).toEqual(expect.any(Date));
};

export const dbConnect = async () => {
  await connect(config.get('db.connection'), {
    useNewUrlParser: true,
  });
};

export const dbDisconnect = async () => {
  await disconnect();
};

export const mockProviders = (module: TestingModule): { sendBird } => {
  const test = module.get<SendBird>(SendBird);
  const spyOnSendBirdCreateUser = jest.spyOn(test, 'createUser');
  const spyOnSendBirdCreateGroupChannel = jest.spyOn(test, 'createGroupChannel');

  spyOnSendBirdCreateUser.mockResolvedValue(true);
  spyOnSendBirdCreateGroupChannel.mockResolvedValue(true);

  return { sendBird: { spyOnSendBirdCreateUser, spyOnSendBirdCreateGroupChannel } };
};
