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
  generateUpdateMemberParams,
  generateUpdateTaskStateParams,
} from '../index';
import {
  CreateMemberParams,
  defaultMemberParams,
  Member,
  MemberDto,
  MemberModule,
  MemberService,
  Sex,
  TaskState,
  UpdateMemberParams,
} from '../../src/member';
import { Errors, ErrorType, Identifier, Language } from '../../src/common';
import { User, UserDto, UserRole } from '../../src/user';
import * as faker from 'faker';
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

  describe('getMembers', () => {
    it('should return empty list for non existing orgId', async () => {
      const result = await service.getByOrg(new Types.ObjectId().toString());
      expect(result).toEqual([]);
    });

    it('should return only 2 members which are within an orgId', async () => {
      const { _id: primaryCoachId } = await modelUser.create(generateCreateUserParams());
      const { _id: orgId1 } = await modelOrg.create(generateOrgParams());
      const { _id: orgId2 } = await modelOrg.create(generateOrgParams());

      const { id: memberId1a } = await generateBasicMember({ primaryCoachId, orgId: orgId1 });
      const { id: memberId1b } = await generateBasicMember({ primaryCoachId, orgId: orgId1 });
      await generateBasicMember({ primaryCoachId, orgId: orgId2 });

      const result = await service.getByOrg(orgId1);
      expect(result.length).toEqual(2);
      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: memberId1a }),
          expect.objectContaining({ id: memberId1b }),
        ]),
      );
    });

    it('should return all members on missing orgId input', async () => {
      const { _id: primaryCoachId } = await modelUser.create(generateCreateUserParams());
      const { _id: orgId1 } = await modelOrg.create(generateOrgParams());
      const { _id: orgId2 } = await modelOrg.create(generateOrgParams());

      const { id: memberId1a } = await generateBasicMember({ primaryCoachId, orgId: orgId1 });
      const { id: memberId1b } = await generateBasicMember({ primaryCoachId, orgId: orgId1 });
      const { id: memberId2 } = await generateBasicMember({ primaryCoachId, orgId: orgId2 });

      const result = await service.getByOrg();
      expect(result.length).toBeGreaterThan(3);
      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: memberId1a }),
          expect.objectContaining({ id: memberId1b }),
          expect.objectContaining({ id: memberId2 }),
        ]),
      );
    });

    it('should handle member with default values', async () => {
      const { _id: primaryCoachId } = await modelUser.create(generateCreateUserParams());
      const { _id: orgId } = await modelOrg.create(generateOrgParams());

      const deviceId = datatype.uuid();
      const { id: memberId } = await generateBasicMember({ primaryCoachId, orgId, deviceId });

      const result = await service.getByOrg(orgId);
      const member = await service.get(deviceId);

      expect(result.length).toEqual(1);
      expect(result[0]).toEqual(
        expect.objectContaining({
          id: memberId,
          name: `${member.firstName} ${member.lastName}`,
          phoneNumber: member.phoneNumber,
          dischargeDate: null,
          adherence: 0,
          wellbeing: 0,
          createdAt: member.createdAt,
          goalsCount: 0,
          actionItemsCount: 0,
          primaryCoach: expect.objectContaining({ _id: primaryCoachId }),
          nextAppointment: undefined,
          appointmentsCount: 0,
        }),
      );
    });

    it('should handle member with all values', async () => {
      const { _id: primaryCoachId } = await modelUser.create(generateCreateUserParams());
      const { _id: orgId } = await modelOrg.create(generateOrgParams());

      const deviceId = datatype.uuid();
      const dischargeDate = date.future(1);
      const createMemberParams = generateCreateMemberParams({
        primaryCoachId,
        orgId,
        deviceId,
        dischargeDate,
      });
      const links = generateMemberLinks(createMemberParams.firstName, createMemberParams.lastName);

      const { id: memberId } = await service.insert({ createMemberParams, ...links });
      await service.insertGoal({
        createTaskParams: generateCreateTaskParams({ memberId }),
        state: TaskState.pending,
      });
      await service.insertActionItem({
        createTaskParams: generateCreateTaskParams({ memberId }),
        state: TaskState.pending,
      });
      await service.insertActionItem({
        createTaskParams: generateCreateTaskParams({ memberId }),
        state: TaskState.pending,
      });

      const result = await service.getByOrg(orgId);
      const member = await service.get(deviceId);

      expect(result.length).toEqual(1);
      expect(result[0]).toEqual(
        expect.objectContaining({
          id: memberId,
          name: `${member.firstName} ${member.lastName}`,
          phoneNumber: member.phoneNumber,
          dischargeDate: member.dischargeDate,
          adherence: 0,
          wellbeing: 0,
          createdAt: member.createdAt,
          goalsCount: 1,
          actionItemsCount: 2,
          primaryCoach: expect.objectContaining({ _id: primaryCoachId }),
          nextAppointment: undefined,
          appointmentsCount: 0,
        }),
      );
    });

    const generateBasicMember = async (createMemberParamsInput?): Promise<Identifier> => {
      const createMemberParams = generateCreateMemberParams(createMemberParamsInput);
      const links = generateMemberLinks(createMemberParams.firstName, createMemberParams.lastName);

      return service.insert({ createMemberParams, ...links });
    };
  });

  describe('insert', () => {
    it('should insert a member without optional params + validate all fields', async () => {
      const primaryCoach = await modelUser.create(generateCreateUserParams());
      const org = await modelOrg.create(generateOrgParams());

      const createMemberParams = generateCreateMemberParams({
        orgId: org._id,
        primaryCoachId: primaryCoach._id,
      });
      const links = generateMemberLinks(createMemberParams.firstName, createMemberParams.lastName);
      const { id } = await service.insert({ createMemberParams, ...links });

      expect(id).not.toBeUndefined();

      const createdMember: any = await memberModel.findById(id);
      compareMembers({
        createdMember,
        createMemberParams,
        links,
        primaryCoachId: primaryCoach._id,
        orgId: org._id,
      });
      expect(createdMember.sex).toEqual(defaultMemberParams.sex);
      expect(createdMember.email).toBeUndefined();
      expect(createdMember.language).toEqual(defaultMemberParams.language);
      expect(createdMember.zipCode).toBeUndefined();
      expect(createdMember.dischargeDate).toBeUndefined();
    });

    it('should insert a member with all params + validate all insert fields', async () => {
      const primaryCoach = await modelUser.create(generateCreateUserParams());
      const org = await modelOrg.create(generateOrgParams());

      const createMemberParams = generateCreateMemberParams({
        orgId: org._id,
        primaryCoachId: primaryCoach._id,
        sex: Sex.female,
        email: internet.email(),
        language: Language.es,
        zipCode: address.zipCode(),
        dischargeDate: date.future(1),
      });
      const links = generateMemberLinks(createMemberParams.firstName, createMemberParams.lastName);
      const { id } = await service.insert({ createMemberParams, ...links });

      expect(id).not.toBeUndefined();

      const createdMember: any = await memberModel.findById(id);
      compareMembers({
        createdMember,
        createMemberParams,
        links,
        primaryCoachId: primaryCoach._id,
        orgId: org._id,
      });
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
      expect(createdMember.createdAt).toEqual(expect.any(Date));
    };

    it('should check that createdAt and updatedAt exists in the collection', async () => {
      const primaryCoach = await modelUser.create(generateCreateUserParams());
      const org = await modelOrg.create(generateOrgParams());

      const createMemberParams = generateCreateMemberParams({
        orgId: org._id,
        primaryCoachId: primaryCoach._id,
      });
      const links = generateMemberLinks(createMemberParams.firstName, createMemberParams.lastName);
      const { id } = await service.insert({ createMemberParams, ...links });

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

  describe('update', () => {
    it('should throw when trying to update non existing member', async () => {
      await expect(
        service.update({ id: new Types.ObjectId().toString(), language: Language.es }),
      ).rejects.toThrow(Errors.get(ErrorType.memberNotFound));
    });

    it('should be able to update partial fields', async () => {
      await updateMember({
        language: Language.es,
        fellowName: faker.name.firstName(),
        readmissionRisk: faker.lorem.words(3),
      });
    });

    it('should be able to receive only id in update', async () => {
      await updateMember();
    });

    it('should handle updating all fields', async () => {
      const params = generateUpdateMemberParams();
      delete params.id;
      await updateMember(params);
    });

    const updateMember = async (updateMemberParams?: Omit<UpdateMemberParams, 'id'>) => {
      const primaryCoach = await modelUser.create(generateCreateUserParams());
      const org = await modelOrg.create(generateOrgParams());

      const createMemberParams = generateCreateMemberParams({
        orgId: org._id,
        primaryCoachId: primaryCoach._id,
      });
      const links = generateMemberLinks(createMemberParams.firstName, createMemberParams.lastName);
      const { id } = await service.insert({ createMemberParams, ...links });

      const beforeObject: any = await memberModel.findById(id);

      await service.update({ id, ...updateMemberParams });
      const afterObject: any = await memberModel.findById(id);

      expect(afterObject.toJSON()).toEqual({
        ...beforeObject.toJSON(),
        ...updateMemberParams,
        updatedAt: afterObject['updatedAt'],
      });
    };
  });

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
