import { User } from '../src/user';
import { connect, disconnect } from 'mongoose';
import * as config from 'config';
import { TestingModule } from '@nestjs/testing';
import { SendBird, Storage } from '../src/providers';

export const compareUsers = (user: User, userBase) => {
  expect(user.id).toEqual(userBase.id);
  expect(user.firstName).toEqual(userBase.firstName);
  expect(user.lastName).toEqual(userBase.lastName);
  expect(user.email).toEqual(userBase.email);
  expect(user.roles).toEqual(expect.arrayContaining(userBase.roles));
  expect(user.avatar).toEqual(userBase.avatar);
  expect(user.createdAt).toEqual(expect.any(Date));
  expect(user.maxCustomers).toEqual(userBase.maxCustomers);
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
  const sendBird = module.get<SendBird>(SendBird);
  const storage = module.get<Storage>(Storage);
  const spyOnSendBirdCreateUser = jest.spyOn(sendBird, 'createUser');
  const spyOnSendBirdCreateGroupChannel = jest.spyOn(sendBird, 'createGroupChannel');
  const spyOnStorage = jest.spyOn(storage, 'getUrl');

  spyOnSendBirdCreateUser.mockResolvedValue(true);
  spyOnSendBirdCreateGroupChannel.mockResolvedValue(true);
  spyOnStorage.mockResolvedValue('https://some-url');

  return { sendBird: { spyOnSendBirdCreateUser, spyOnSendBirdCreateGroupChannel } };
};
