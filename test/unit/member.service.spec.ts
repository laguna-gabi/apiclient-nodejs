import { Test, TestingModule } from '@nestjs/testing';
import { DbModule } from '../../src/db/db.module';
import * as mongoose from 'mongoose';
import { Model, Types } from 'mongoose';
import { ObjectID } from 'bson';
import {
  connectToDb,
  generateCreateUserParams,
  generateCreateMemberParams,
} from '../index';
import { MemberService } from '../../src/member/member.service';
import {
  CreateMemberParams,
  Member,
  MemberDto,
} from '../../src/member/member.dto';
import { MemberModule } from '../../src/member/member.module';
import { User, UserRole, UserDto } from '../../src/user/user.dto';
import { Errors } from '../../src/common';

describe('MemberService', () => {
  let service: MemberService;
  let model: Model<typeof MemberDto>;
  let modelUser: Model<typeof UserDto>;
  const primaryCoachId = new ObjectID().toString();

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [DbModule, MemberModule],
    }).compile();

    service = module.get<MemberService>(MemberService);

    model = mongoose.model(Member.name, MemberDto);
    modelUser = mongoose.model(User.name, UserDto);
    await connectToDb();
  });

  describe('get', () => {
    it('should return null for non existing member', async () => {
      const id = new ObjectID();
      const result = await service.get(id.toString());
      expect(result).toBeNull();
    });

    it('should return member and his/her users for an existing member', async () => {
      const primaryCoachParams = generateCreateUserParams();
      const nurseParams = generateCreateUserParams({ roles: [UserRole.nurse] });
      const userParams = generateCreateUserParams();
      const primaryCoach = await modelUser.create(primaryCoachParams);
      const nurse = await modelUser.create(nurseParams);
      const user = await modelUser.create(userParams);
      await modelUser.create(generateCreateUserParams()); //Another user, to check if it doesn't return in member

      const member: CreateMemberParams = generateCreateMemberParams({
        primaryCoachId: primaryCoach._id,
        usersIds: [user._id, nurse._id],
      });

      const { _id } = await model.create({
        phoneNumber: member.phoneNumber,
        name: member.name,
        primaryCoach: new Types.ObjectId(member.primaryCoachId),
        users: member.usersIds.map((item) => new Types.ObjectId(item)),
      });

      const result = await service.get(_id);

      expect(result.id).toEqual(_id.toString());
      expect(result.phoneNumber).toEqual(member.phoneNumber);
      expect(result.name).toEqual(member.name);
      compareUsers(result.primaryCoach, primaryCoach);
      expect(result.users.length).toEqual(2);
      compareUsers(result.users[0], user);
      compareUsers(result.users[1], nurse);
    });

    const compareUsers = (user: User, userBase) => {
      expect(user.id).toEqual(userBase._id.toString());
      expect(user.name).toEqual(userBase['name']);
      expect(user.email).toEqual(userBase['email']);
      expect(user.roles).toEqual(expect.arrayContaining(userBase['roles']));
      expect(user.photoUrl).toEqual(userBase['photoUrl']);
    };
  });

  describe('insert', () => {
    it('should insert a member with primaryCoach and validate all insert fields', async () => {
      const primaryCoachParams = generateCreateUserParams();
      const primaryCoach = await modelUser.create(primaryCoachParams);

      const memberParams = generateCreateMemberParams({
        primaryCoachId: primaryCoach._id,
      });
      const result = await service.insert(memberParams);

      expect(result.id).not.toBeUndefined();

      const createdMember = await model.findById(result.id);
      expect(createdMember['phoneNumber']).toEqual(memberParams.phoneNumber);
      expect(createdMember['name']).toEqual(memberParams.name);
      expect(createdMember['dateOfBirth']).toEqual(memberParams.dateOfBirth);
      expect(createdMember['primaryCoach']).toEqual(primaryCoach._id);
    });

    it('should check that createdAt and updatedAt exists in the collection', async () => {
      const params = generateCreateUserParams();
      const user = await modelUser.create(params);

      const result = await service.insert(generateCreateMemberParams(user._id));

      const createdMember = await model.findById(result.id);
      expect(createdMember['createdAt']).toEqual(expect.any(Date));
      expect(createdMember['updatedAt']).toEqual(expect.any(Date));
    });

    it('should insert a member even with primaryCoach not exists', async () => {
      const member: CreateMemberParams = generateCreateMemberParams({
        primaryCoachId,
      });

      const result = await service.insert(member);
      expect(result.id).not.toBeUndefined();
    });

    it('should fail to insert an already existing member', async () => {
      const member = generateCreateMemberParams({ primaryCoachId });
      await service.insert(member);

      await expect(service.insert(member)).rejects.toThrow(
        `${Errors.member.create.title} : ${Errors.member.create.reasons.phoneNumber}`,
      );
    });
  });
});
