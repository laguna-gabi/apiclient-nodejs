import { Test, TestingModule } from '@nestjs/testing';
import { DbModule } from '../../src/db/db.module';
import * as mongoose from 'mongoose';
import { Model, Types } from 'mongoose';
import { ObjectID } from 'bson';
import {
  connectToDb,
  generateCreateCoachParams,
  generateCreateMemberParams,
} from '../index';
import { MemberService } from '../../src/member/member.service';
import {
  CreateMemberParams,
  Member,
  MemberSchema,
} from '../../src/member/member.dto';
import { MemberModule } from '../../src/member/member.module';
import { Coach, CoachRole, CoachSchema } from '../../src/coach/coach.dto';
import { Errors } from '../../src/common';

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

    it('should return member and his/her coaches for an existing member', async () => {
      const primaryCoachParams = generateCreateCoachParams();
      const nurseParams = generateCreateCoachParams(CoachRole.nurse);
      const coachParams = generateCreateCoachParams();
      const primaryCoach = await modelCoach.create(primaryCoachParams);
      const nurse = await modelCoach.create(nurseParams);
      const coach = await modelCoach.create(coachParams);
      await modelCoach.create(generateCreateCoachParams()); //Another coach, to check if it doesn't return in member

      const member: CreateMemberParams = generateCreateMemberParams(
        primaryCoach._id,
        [coach._id, nurse._id],
      );

      const { _id } = await model.create({
        name: member.name,
        phoneNumber: member.phoneNumber,
        primaryCoach: new Types.ObjectId(member.primaryCoachId),
        coaches: member.coachIds.map((item) => new Types.ObjectId(item)),
      });

      const result = await service.get({ id: _id });

      expect(result._id).toEqual(_id);
      expect(result.name).toEqual(member.name);
      expect(result.phoneNumber).toEqual(member.phoneNumber);
      compareCoach(result.primaryCoach, primaryCoach);
      expect(result.coaches.length).toEqual(2);
      compareCoach(result.coaches[0], coach);
      compareCoach(result.coaches[1], nurse);
    });

    const compareCoach = (resultCoach: Coach, coach) => {
      expect(resultCoach._id).toEqual(coach._id);
      expect(resultCoach.name).toEqual(coach['name']);
      expect(resultCoach.email).toEqual(coach['email']);
      expect(resultCoach.role).toEqual(coach['role']);
      expect(resultCoach.photoUrl).toEqual(coach['photoUrl']);
    };
  });

  describe('insert', () => {
    it('should insert a member with primaryCoach', async () => {
      const primaryCoachParams = generateCreateCoachParams();
      const primaryCoach = await modelCoach.create(primaryCoachParams);
      const member: CreateMemberParams = generateCreateMemberParams(
        primaryCoach._id,
      );

      const result = await service.insert(member);

      expect(result._id).not.toBeUndefined();
    });

    it('should insert a member even with primaryCoach not exists', async () => {
      const member: CreateMemberParams = generateCreateMemberParams(
        new ObjectID().toString(),
      );

      const result = await service.insert(member);
      expect(result._id).not.toBeUndefined();
    });

    it('should fail to insert an already existing member', async () => {
      const member = generateCreateMemberParams(new ObjectID().toString());
      await service.insert(member);

      await expect(service.insert(member)).rejects.toThrow(
        `${Errors.member.create.title} : ${Errors.member.create.reasons.phoneNumber}`,
      );
    });
  });
});
