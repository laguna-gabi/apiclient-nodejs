import { Test, TestingModule } from '@nestjs/testing';
import { DbModule } from '../../src/db/db.module';
import { Model, model, Types } from 'mongoose';
import {
  compareUsers,
  dbConnect,
  dbDisconnect,
  generateCreateMemberParams,
  generateCreateTaskParams,
  generateCreateUserParams,
  generateMemberLinks,
  generateOrgParams,
  generateUpdateTaskStateParams,
  Links,
} from '../index';
import {
  CreateMemberParams,
  defaultMemberParams,
  Language,
  Member,
  MemberDto,
  MemberModule,
  MemberService,
  Sex,
  TaskState,
} from '../../src/member';
import { Errors, ErrorType } from '../../src/common';
import { User, UserDto, UserRole } from '../../src/user';
import { address, datatype, date, internet } from 'faker';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AppointmentModule } from '../../src/appointment';
import { Org, OrgDto } from '../../src/org';

describe('MemberService', () => {
  let module: TestingModule;
  let service: MemberService;
  let memberModel: Model<typeof MemberDto>;
  let modelUser: Model<typeof UserDto>;
  let modelOrg: Model<typeof OrgDto>;
  const primaryCoachId = new Types.ObjectId().toString();

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [DbModule, MemberModule, AppointmentModule, EventEmitterModule.forRoot()],
    }).compile();

    service = module.get<MemberService>(MemberService);

    memberModel = model(Member.name, MemberDto);
    modelUser = model(User.name, UserDto);
    modelOrg = model(Org.name, OrgDto);
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
      const orgParams = generateOrgParams();
      const org = await modelOrg.create(orgParams);

      const deviceId = datatype.uuid();
      const member: CreateMemberParams = generateCreateMemberParams({
        deviceId,
        orgId: new Types.ObjectId().toString(),
        primaryCoachId: primaryCoach._id,
        usersIds: [user._id, nurse._id],
      });

      const links = generateMemberLinks(member.firstName, member.lastName);

      const { _id } = await memberModel.create({
        phoneNumber: member.phoneNumber,
        deviceId,
        firstName: member.firstName,
        lastName: member.lastName,
        org: new Types.ObjectId(org.id),
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
      expect(result.org).toEqual(expect.objectContaining(orgParams));
      compareUsers(result.primaryCoach, primaryCoach);
      expect(result.users.length).toEqual(2);
      compareUsers(result.users[0], user);
      compareUsers(result.users[1], nurse);
    });
  });

  describe('insert', () => {
    it('should insert a member without optional params + validate all fields', async () => {
      const { id, links, createMemberParams, primaryCoachId, orgId } =
        await createInitialRequirements();

      expect(id).not.toBeUndefined();

      const createdMember: any = await memberModel.findById(id);
      compareMembers({ createdMember, createMemberParams, links, primaryCoachId, orgId });
      expect(createdMember.sex).toEqual(defaultMemberParams.sex);
      expect(createdMember.email).toBeUndefined();
      expect(createdMember.language).toEqual(defaultMemberParams.language);
      expect(createdMember.zipCode).toBeUndefined();
      expect(createdMember.dischargeDate).toBeUndefined();
    });

    it('should insert a member with all params + validate all insert fields', async () => {
      const { id, links, createMemberParams, primaryCoachId, orgId } =
        await createInitialRequirements({
          sex: Sex.female,
          email: internet.email(),
          language: Language.es,
          zipCode: address.zipCode(),
          dischargeDate: date.future(1),
        });

      expect(id).not.toBeUndefined();

      const createdMember: any = await memberModel.findById(id);
      compareMembers({ createdMember, createMemberParams, links, primaryCoachId, orgId });
      expect(createdMember.sex).toEqual(createMemberParams.sex);
      expect(createdMember.email).toEqual(createMemberParams.email);
      expect(createdMember.language).toEqual(createMemberParams.language);
      expect(createdMember.zipCode).toEqual(createMemberParams.zipCode);
      expect(createdMember.dischargeDate).toEqual(createMemberParams.dischargeDate);
    });

    const compareMembers = ({
      createdMember,
      createMemberParams,
      links,
      primaryCoachId,
      orgId,
    }) => {
      expect(createdMember.phoneNumber).toEqual(createMemberParams.phoneNumber);
      expect(createdMember.deviceId).toEqual(createMemberParams.deviceId);
      expect(createdMember.firstName).toEqual(createMemberParams.firstName);
      expect(createdMember.lastName).toEqual(createMemberParams.lastName);
      expect(createdMember.dischargeNotesLink).toEqual(links.dischargeNotesLink);
      expect(createdMember.dischargeInstructionsLink).toEqual(links.dischargeInstructionsLink);
      expect(createdMember.dateOfBirth).toEqual(createMemberParams.dateOfBirth);
      expect(createdMember.primaryCoach).toEqual(primaryCoachId);
      expect(createdMember.org).toEqual(orgId);
    };

    it('should check that createdAt and updatedAt exists in the collection', async () => {
      const { id } = await createInitialRequirements();

      const createdMember: any = await memberModel.findById(id);
      expect(createdMember.createdAt).toEqual(expect.any(Date));
      expect(createdMember.updatedAt).toEqual(expect.any(Date));
    });

    it('should insert a member even with primaryCoach not exists', async () => {
      const createMemberParams: CreateMemberParams = generateCreateMemberParams({
        orgId: new Types.ObjectId().toString(),
        primaryCoachId,
      });
      const links = generateMemberLinks(createMemberParams.firstName, createMemberParams.lastName);

      const result = await service.insert({ createMemberParams, ...links });

      expect(result.id).not.toBeUndefined();
    });

    it('should fail to insert an already existing member', async () => {
      const createMemberParams = generateCreateMemberParams({
        orgId: new Types.ObjectId().toString(),
        primaryCoachId,
      });
      const links = generateMemberLinks(createMemberParams.firstName, createMemberParams.lastName);

      await service.insert({ createMemberParams, ...links });

      await expect(service.insert({ createMemberParams, ...links })).rejects.toThrow(
        Errors.get(ErrorType.memberPhoneAlreadyExists),
      );
    });
  });

  const createInitialRequirements = async (
    createMembersExtraInput?,
  ): Promise<{
    id: string;
    links: Links;
    createMemberParams: CreateMemberParams;
    primaryCoachId: string;
    orgId: string;
  }> => {
    const primaryCoachParams = generateCreateUserParams();
    const primaryCoach = await modelUser.create(primaryCoachParams);
    const orgParams = generateOrgParams();
    const org = await modelOrg.create(orgParams);

    const createMemberParams = generateCreateMemberParams({
      orgId: org._id,
      primaryCoachId: primaryCoach._id,
      ...createMembersExtraInput,
    });
    const links = generateMemberLinks(createMemberParams.firstName, createMemberParams.lastName);
    const result = await service.insert({ createMemberParams, ...links });

    return {
      id: result.id,
      links,
      createMemberParams,
      primaryCoachId: primaryCoach._id,
      orgId: org._id,
    };
  };

  describe('insertGoal', () => {
    it('should insert a goal', async () => {
      const createTaskParams = generateCreateTaskParams();
      const { id } = await service.insertGoal({ createTaskParams, state: TaskState.pending });

      expect(id).toEqual(expect.any(Types.ObjectId));
    });
  });

  describe('updateGoalState', () => {
    it('should update an existing goal state', async () => {
      const createTaskParams = generateCreateTaskParams();
      const { id } = await service.insertGoal({ createTaskParams, state: TaskState.pending });

      await service.updateGoalState({ id, state: TaskState.reached });
    });

    it('should not be able to update state for a non existing goal', async () => {
      await expect(service.updateGoalState(generateUpdateTaskStateParams())).rejects.toThrow(
        Errors.get(ErrorType.memberGoalIdNotFound),
      );
    });
  });

  describe('insertActionItem', () => {
    it('should insert an action item', async () => {
      const createTaskParams = generateCreateTaskParams();
      const { id } = await service.insertActionItem({
        createTaskParams,
        state: TaskState.pending,
      });

      expect(id).toEqual(expect.any(Types.ObjectId));
    });
  });

  describe('updateActionItemState', () => {
    it('should update an existing action item state', async () => {
      const createTaskParams = generateCreateTaskParams();
      const { id } = await service.insertActionItem({
        createTaskParams,
        state: TaskState.pending,
      });

      await service.updateActionItemState({ id, state: TaskState.reached });
    });

    it('should not be able to update state for a non existing action item', async () => {
      await expect(service.updateActionItemState(generateUpdateTaskStateParams())).rejects.toThrow(
        Errors.get(ErrorType.memberActionItemIdNotFound),
      );
    });
  });
});
