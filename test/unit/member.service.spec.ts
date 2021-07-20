import { Test, TestingModule } from '@nestjs/testing';
import { DbModule } from '../../src/db/db.module';
import { Model, model, Types } from 'mongoose';
import {
  compareUsers,
  dbConnect,
  dbDisconnect,
  generateCreateMemberParams,
  generateCreateUserParams,
  generateMemberLinks,
} from '../index';
import {
  CreateMemberParams,
  Member,
  MemberDto,
  MemberModule,
  MemberService,
} from '../../src/member';
import { Errors, ErrorType } from '../../src/common';
import { User, UserDto, UserRole } from '../../src/user';
import { datatype } from 'faker';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AppointmentModule } from '../../src/appointment';

describe('MemberService', () => {
  let module: TestingModule;
  let service: MemberService;
  let memberModel: Model<typeof MemberDto>;
  let modelUser: Model<typeof UserDto>;
  const primaryCoachId = new Types.ObjectId().toString();

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [DbModule, MemberModule, AppointmentModule, EventEmitterModule.forRoot()],
    }).compile();

    service = module.get<MemberService>(MemberService);

    memberModel = model(Member.name, MemberDto);
    modelUser = model(User.name, UserDto);
    await dbConnect();
  });

  afterAll(async () => {
    await module.close();
    await dbDisconnect();
  });

  describe('get', () => {
    it('should return null for non existing deviceId of a member', async () => {
      const result = await service.get(datatype.uuid());
      expect(result).toBeNull();
    });

    it('should return member and his/her users for an existing member', async () => {
      const primaryCoachParams = generateCreateUserParams();
      const nurseParams = generateCreateUserParams({ roles: [UserRole.nurse] });
      const userParams = generateCreateUserParams();
      const primaryCoach = await modelUser.create(primaryCoachParams);
      const nurse = await modelUser.create(nurseParams);
      const user = await modelUser.create(userParams);
      //Another user, to check if it doesn't return in member
      await modelUser.create(generateCreateUserParams());

      const deviceId = datatype.uuid();
      const member: CreateMemberParams = generateCreateMemberParams({
        deviceId,
        primaryCoachId: primaryCoach._id,
        usersIds: [user._id, nurse._id],
      });

      const links = generateMemberLinks(member.firstName, member.lastName);

      const { _id } = await memberModel.create({
        phoneNumber: member.phoneNumber,
        deviceId,
        firstName: member.firstName,
        lastName: member.lastName,
        primaryCoach: new Types.ObjectId(member.primaryCoachId),
        users: member.usersIds.map((item) => new Types.ObjectId(item)),
        ...links,
      });

      const result = await service.get(member.deviceId);

      expect(result.id).toEqual(_id.toString());
      expect(result.phoneNumber).toEqual(member.phoneNumber);
      expect(result.deviceId).toEqual(member.deviceId);
      expect(result.firstName).toEqual(member.firstName);
      expect(result.lastName).toEqual(member.lastName);
      expect(result.dischargeNotesLink).toEqual(links.dischargeNotesLink);
      expect(result.dischargeInstructionsLink).toEqual(links.dischargeInstructionsLink);
      compareUsers(result.primaryCoach, primaryCoach);
      expect(result.users.length).toEqual(2);
      compareUsers(result.users[0], user);
      compareUsers(result.users[1], nurse);
    });
  });

  describe('insert', () => {
    it('should insert a member with primaryCoach and validate all insert fields', async () => {
      const primaryCoachParams = generateCreateUserParams();
      const primaryCoach = await modelUser.create(primaryCoachParams);

      const createMemberParams = generateCreateMemberParams({
        primaryCoachId: primaryCoach._id,
      });
      const links = generateMemberLinks(createMemberParams.firstName, createMemberParams.lastName);
      const result = await service.insert({
        createMemberParams,
        ...links,
      });

      expect(result.id).not.toBeUndefined();

      const createdMember = await memberModel.findById(result.id);
      expect(createdMember['phoneNumber']).toEqual(createMemberParams.phoneNumber);
      expect(createdMember['deviceId']).toEqual(createMemberParams.deviceId);
      expect(createdMember['firstName']).toEqual(createMemberParams.firstName);
      expect(createdMember['lastName']).toEqual(createMemberParams.lastName);
      expect(createdMember['dischargeNotesLink']).toEqual(links.dischargeNotesLink);
      expect(createdMember['dischargeInstructionsLink']).toEqual(links.dischargeInstructionsLink);
      expect(createdMember['dateOfBirth']).toEqual(createMemberParams.dateOfBirth);
      expect(createdMember['primaryCoach']).toEqual(primaryCoach._id);
    });

    it('should check that createdAt and updatedAt exists in the collection', async () => {
      const params = generateCreateUserParams();
      const user = await modelUser.create(params);
      const createMemberParams = generateCreateMemberParams(user._id);
      const links = generateMemberLinks(createMemberParams.firstName, createMemberParams.lastName);

      const result = await service.insert({ createMemberParams, ...links });

      const createdMember = await memberModel.findById(result.id);
      expect(createdMember['createdAt']).toEqual(expect.any(Date));
      expect(createdMember['updatedAt']).toEqual(expect.any(Date));
    });

    it('should insert a member even with primaryCoach not exists', async () => {
      const createMemberParams: CreateMemberParams = generateCreateMemberParams({ primaryCoachId });
      const links = generateMemberLinks(createMemberParams.firstName, createMemberParams.lastName);

      const result = await service.insert({ createMemberParams, ...links });

      expect(result.id).not.toBeUndefined();
    });

    it('should fail to insert an already existing member', async () => {
      const createMemberParams = generateCreateMemberParams({ primaryCoachId });
      const links = generateMemberLinks(createMemberParams.firstName, createMemberParams.lastName);

      await service.insert({ createMemberParams, ...links });

      await expect(service.insert({ createMemberParams, ...links })).rejects.toThrow(
        Errors.get(ErrorType.memberPhoneAlreadyExists),
      );
    });
  });
});
