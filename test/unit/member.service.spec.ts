import { Test, TestingModule } from '@nestjs/testing';
import { DbModule } from '../../src/db/db.module';
import * as mongoose from 'mongoose';
import { Model } from 'mongoose';
import { ObjectID } from 'bson';
import { connectToDb, generateCreateCoachParams } from '../index';
import { MemberService } from '../../src/member/member.service';
import {
  CreateMemberParams,
  Member,
  MemberSchema,
} from '../../src/member/member.dto';
import { MemberModule } from '../../src/member/member.module';
import { Coach, CoachRole, CoachSchema } from '../../src/coach/coach.dto';
import * as faker from 'faker';

describe('MemberService', () => {
  let service: MemberService;
  let model: Model<typeof MemberSchema>;
  let modelCoach: Model<typeof CoachSchema>;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [DbModule, MemberModule],
    }).compile();

    service = module.get<MemberService>(MemberService);

    model = mongoose.model(Member.name, MemberSchema);
    modelCoach = mongoose.model(Coach.name, CoachSchema);
    await connectToDb();
  });

  describe('get', () => {
    it('should return null for non existing member', async () => {
      const id = new ObjectID();
      const result = await service.get({ id: id.toString() });
      expect(result).toBeNull();
    });

    it.only('should return member and his/her coaches for an existing member', async () => {
      const primaryCoachParams = generateCreateCoachParams();
      const nurseParams = generateCreateCoachParams(CoachRole.nurse);
      const coachParams = generateCreateCoachParams();
      const primaryCoach = await modelCoach.create(primaryCoachParams);
      const nurse = await modelCoach.create(nurseParams);
      const coach = await modelCoach.create(coachParams);

      const member: CreateMemberParams = {
        name: 'name123',
        primaryCoachId: primaryCoach._id,
        coachIds: [coach._id, nurse._id],
      };

      console.log(member);

      const { id } = await model.create(member);

      const result = await service.get({ id });
      console.log('result', result);
      expect(result).toEqual(expect.objectContaining(coach));
    });
  });

  // describe.skip('insert', () => {
  //   test.each([CoachRole.coach, CoachRole.nurse])(
  //     'should insert a %p',
  //     async (role) => {
  //       const coach = generateCreateCoachParams(role);
  //       const { _id } = await service.insert(coach);
  //
  //       expect(_id).not.toBeNull();
  //     },
  //   );
  //
  //   it('should handling a coach that already exists', async () => {
  //     const coach = generateCreateCoachParams();
  //     await service.insert(coach);
  //
  //     await expect(service.insert(coach)).rejects.toThrow(
  //       `${Errors.coach.create.title} : ${Errors.coach.create.reasons.email}`,
  //     );
  //   });
  // });
});
