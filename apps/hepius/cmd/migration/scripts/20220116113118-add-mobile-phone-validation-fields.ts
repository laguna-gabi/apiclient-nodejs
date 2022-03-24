/* eslint-disable @typescript-eslint/no-unused-vars */
import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AppModule } from '../../../src/app.module';
import { Member } from '../../../src/member';
import { TwilioService } from '../../../src/providers';

export const up = async (dryRun: boolean) => {
  const app = await NestFactory.createApplicationContext(AppModule);
  const memberModel = app.get<Model<Member>>(getModelToken(Member.name));
  const twilioService = app.get<TwilioService>(TwilioService);

  const members = await memberModel.find({});
  await Promise.all(
    members.map(async (member) => {
      const phoneType = await twilioService.getPhoneType(member.phone);
      const objPhoneSecondary = member.phoneSecondary
        ? { phoneSecondaryType: await twilioService.getPhoneType(member.phoneSecondary) }
        : {};
      await memberModel.findByIdAndUpdate(
        { _id: member._id },
        { $set: { phoneType, ...objPhoneSecondary } },
      );
    }),
  );
};

export const down = async (dryRun: boolean) => {
  const app = await NestFactory.createApplicationContext(AppModule);
  const memberModel = app.get<Model<Member>>(getModelToken(Member.name));

  await memberModel.updateMany({}, { $unset: { isMobilePhone: 1, isMobilePhoneSecondary: 1 } });
};
