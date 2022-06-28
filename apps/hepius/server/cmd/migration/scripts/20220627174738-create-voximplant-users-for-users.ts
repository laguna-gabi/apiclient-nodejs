/* eslint-disable @typescript-eslint/no-unused-vars */
import { User } from '@argus/hepiusClient';
import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { Db } from 'mongodb';
import { Model, Types } from 'mongoose';
import { nanoid } from 'nanoid';
import { AppModule } from '../../../src/app.module';
import { Voximplant } from '../../../src/providers';
import { UserConfig } from '../../../src/user';

// ------------------------------------------------------------------------------------------------
// Description: migrate `up`
// ------------------------------------------------------------------------------------------------
export const up = async (dryRun: boolean, db: Db) => {
  const app = await NestFactory.createApplicationContext(AppModule);
  const voximplant = app.get<Voximplant>(Voximplant);
  const userModel = app.get<Model<User>>(getModelToken(User.name));
  const userConfigModel = app.get<Model<UserConfig>>(getModelToken(UserConfig.name));

  const users = await userModel.find();
  await Promise.all(
    users.map(async (user) => {
      const voximplantPassword = nanoid();
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const { userId: voximplantId } = await voximplant.client.Users.addUser({
        userName: user.id,
        userDisplayName: `${user.firstName} ${user.lastName}`,
        userPassword: voximplantPassword,
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        applicationName: voximplant.applicationName,
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        applicationId: voximplant.applicationId,
        mobilePhone: user.phone,
      });
      return userConfigModel.updateOne(
        { userId: new Types.ObjectId(user.id) },
        { $set: { voximplantId, voximplantPassword } },
      );
    }),
  );
};

// ------------------------------------------------------------------------------------------------
// Description: migrate `down`
// ------------------------------------------------------------------------------------------------
export const down = async (dryRun: boolean, db: Db) => {
  const app = await NestFactory.createApplicationContext(AppModule);
  const voximplant = app.get<Voximplant>(Voximplant);
  const userConfigModel = app.get<Model<UserConfig>>(getModelToken(UserConfig.name));

  const userConfigs = await userConfigModel.find();
  await Promise.all(
    userConfigs.map(async (userConfig) => {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      await voximplant.client.Users.delUser({
        userId: userConfig.voximplantId,
        userName: userConfig.userId.toString(),
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        applicationName: voximplant.applicationName,
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        applicationId: voximplant.applicationId,
      });
      return db
        .collection('userconfigs')
        .updateOne(
          { userId: new Types.ObjectId(userConfig.userId) },
          { $unset: { voximplantId: 1, voximplantPassword: 1 } },
        );
    }),
  );
};
