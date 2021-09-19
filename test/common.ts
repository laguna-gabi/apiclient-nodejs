import { User } from '../src/user';
import { connect, disconnect } from 'mongoose';
import * as config from 'config';
import { TestingModule } from '@nestjs/testing';
import { NotificationsService, SendBird, StorageService, TwilioService } from '../src/providers';
import { apiPrefix } from '../src/common';
import { v4 } from 'uuid';
import { DbModule } from '../src/db/db.module';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';

export const urls = {
  scheduleAppointments: `/${apiPrefix}/appointments/schedule`,
  slots: `/${apiPrefix}/users/slots`,
  members: `/${apiPrefix}/members/create`,
};

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
  await connect(config.get('db.connection'), { useNewUrlParser: true });
};

export const dbDisconnect = async () => {
  await disconnect();
};

export const delay = async (milliseconds: number) => {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
};

export const defaultModules = () => {
  return [DbModule, EventEmitterModule.forRoot(), ScheduleModule.forRoot()];
};

export const mockProviders = (
  module: TestingModule,
): { sendBird; notificationsService; twilioService } => {
  const sendBird = module.get<SendBird>(SendBird);
  const storage = module.get<StorageService>(StorageService);
  const notificationsService = module.get<NotificationsService>(NotificationsService);
  const twilioService = module.get<TwilioService>(TwilioService);

  const spyOnSendBirdCreateUser = jest.spyOn(sendBird, 'createUser');
  const spyOnSendBirdCreateGroupChannel = jest.spyOn(sendBird, 'createGroupChannel');
  const spyOnSendBirdFreeze = jest.spyOn(sendBird, 'freezeGroupChannel');
  const spyOnSendBirdUpdateGroupChannelMetadata = jest.spyOn(
    sendBird,
    'updateGroupChannelMetadata',
  );
  const spyOnSendBirdDeleteGroupChannelMetadata = jest.spyOn(
    sendBird,
    'deleteGroupChannelMetadata',
  );
  const spyOnStorage = jest.spyOn(storage, 'getUrl');
  const spyOnNotificationsServiceRegister = jest.spyOn(notificationsService, 'register');
  const spyOnNotificationsServiceSend = jest.spyOn(notificationsService, 'send');
  const spyOnNotificationsServiceCancel = jest.spyOn(notificationsService, 'cancel');
  const spyOnTwilioGetToken = jest.spyOn(twilioService, 'getAccessToken');

  spyOnSendBirdCreateUser.mockResolvedValue(v4());
  spyOnSendBirdCreateGroupChannel.mockResolvedValue(true);
  spyOnSendBirdFreeze.mockResolvedValue(undefined);
  spyOnSendBirdUpdateGroupChannelMetadata.mockResolvedValue(undefined);
  spyOnSendBirdDeleteGroupChannelMetadata.mockResolvedValue(undefined);
  spyOnStorage.mockResolvedValue('https://some-url');
  spyOnNotificationsServiceRegister.mockResolvedValue(v4());
  spyOnNotificationsServiceSend.mockResolvedValue(v4());
  spyOnNotificationsServiceCancel.mockResolvedValue(v4());
  spyOnTwilioGetToken.mockReturnValue('token');

  return {
    sendBird: {
      spyOnSendBirdCreateUser,
      spyOnSendBirdCreateGroupChannel,
      spyOnSendBirdFreeze,
      spyOnSendBirdUpdateGroupChannelMetadata,
      spyOnSendBirdDeleteGroupChannelMetadata,
    },
    notificationsService: {
      spyOnNotificationsServiceRegister,
      spyOnNotificationsServiceSend,
      spyOnNotificationsServiceCancel,
    },
    twilioService: { spyOnTwilioGetToken },
  };
};
