import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AppModule } from '../../../src/app.module';
import { Member } from '../../../src/member';
import { momentFormats } from '../../../src/common';
import { format } from 'date-fns';

export const up = async () => {
  const app = await NestFactory.createApplicationContext(AppModule);
  const memberModel = app.get<Model<Member>>(getModelToken(Member.name));

  const membersWithAdmitDate = await memberModel.find({ admitDate: { $exists: 1 } });
  await Promise.all(
    membersWithAdmitDate.map(async (member) => {
      await memberModel.findByIdAndUpdate(member._id, {
        $set: { admitDate: format(new Date(member.admitDate), momentFormats.date) },
      });
    }),
  );

  const membersWithDischargeDate = await memberModel.find({ dischargeDate: { $exists: 1 } });
  await Promise.all(
    membersWithDischargeDate.map(async (member) => {
      await memberModel.findByIdAndUpdate(member._id, {
        $set: { dischargeDate: format(new Date(member.dischargeDate), momentFormats.date) },
      });
    }),
  );
};

// eslint-disable-next-line @typescript-eslint/no-empty-function
export const down = async () => {};
