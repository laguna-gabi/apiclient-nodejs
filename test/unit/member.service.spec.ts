import { Test, TestingModule } from '@nestjs/testing';
import { DbModule } from '../../src/db/db.module';
import { Model, model, Types } from 'mongoose';
import {
  compareUsers,
  dbConnect,
  dbDisconnect,
  generateCreateMemberParams,
  generateCreateRawUserParams,
  generateCreateTaskParams,
  generateId,
  generateObjectId,
  generateDateOnly,
  generateOrgParams,
  generateRequestAppointmentParams,
  generateScheduleAppointmentParams,
  generateSetGeneralNotesParams,
  generateUpdateMemberParams,
  generateUpdateTaskStatusParams,
  generateZipCode,
} from '../index';
import {
  CreateMemberParams,
  defaultMemberParams,
  Honorific,
  Member,
  MemberDto,
  MemberModule,
  MemberService,
  NotNullableMemberKeys,
  Sex,
  TaskStatus,
  UpdateMemberParams,
} from '../../src/member';
import { Errors, ErrorType, Identifier, Language } from '../../src/common';
import { User, UserDto, UserRole } from '../../src/user';
import * as faker from 'faker';
import { datatype, date, internet } from 'faker';
import { EventEmitterModule } from '@nestjs/event-emitter';
import {
  Appointment,
  AppointmentDto,
  AppointmentModule,
  AppointmentStatus,
} from '../../src/appointment';
import { Org, OrgDto } from '../../src/org';
import { v4 } from 'uuid';

describe('MemberService', () => {
  let module: TestingModule;
  let service: MemberService;
  let memberModel: Model<typeof MemberDto>;
  let modelUser: Model<typeof UserDto>;
  let modelOrg: Model<typeof OrgDto>;
  let modelAppointment: Model<typeof AppointmentDto>;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [DbModule, MemberModule, AppointmentModule, EventEmitterModule.forRoot()],
    }).compile();

    service = module.get<MemberService>(MemberService);

    memberModel = model(Member.name, MemberDto);
    modelUser = model(User.name, UserDto);
    modelOrg = model(Org.name, OrgDto);
    modelAppointment = model(Appointment.name, AppointmentDto);
    await dbConnect();
  });

  afterAll(async () => {
    await module.close();
    await dbDisconnect();
  });

  describe('getByDeviceId + get', () => {
    it('should throw error on a non existing deviceId of a member', async () => {
      await expect(service.getByDeviceId(datatype.uuid())).rejects.toThrow(
        Errors.get(ErrorType.memberNotFound),
      );
    });

    it('should throw error on a non existing id of a member', async () => {
      await expect(service.get(generateId())).rejects.toThrow(Errors.get(ErrorType.memberNotFound));
    });

    test.each`
      field        | method
      ${'context'} | ${(deviceId) => service.getByDeviceId(deviceId)}
      ${'id'}      | ${(id) => service.get(id)}
    `(
      `should return member and his/her users for an existing member using $field`,
      async (params) => {
        const primaryUserParams = generateCreateRawUserParams();
        const nurseParams = generateCreateRawUserParams({ roles: [UserRole.nurse] });
        const userParams = generateCreateRawUserParams();
        const primaryUser = await modelUser.create(primaryUserParams);
        const nurse = await modelUser.create(nurseParams);
        const user = await modelUser.create(userParams);
        //Another user, to check if it doesn't return in member
        await modelUser.create(generateCreateRawUserParams());
        const orgParams = generateOrgParams();
        const org = await modelOrg.create(orgParams);

        const deviceId = datatype.uuid();
        const member: CreateMemberParams = generateCreateMemberParams({
          deviceId,
          orgId: generateId(),
          primaryUserId: primaryUser._id,
          usersIds: [user._id, nurse._id, primaryUser._id],
        });

        const { _id } = await memberModel.create({
          phone: member.phone,
          deviceId,
          firstName: member.firstName,
          lastName: member.lastName,
          org: generateObjectId(org.id),
          primaryUserId: member.primaryUserId,
          users: member.usersIds,
        });

        const result = await params.method(params.field === 'context' ? member.deviceId : _id);

        expect(result.id).toEqual(_id.toString());
        expect(result.phone).toEqual(member.phone);
        expect(result.deviceId).toEqual(member.deviceId);
        expect(result.firstName).toEqual(member.firstName);
        expect(result.lastName).toEqual(member.lastName);
        expect(result.org).toEqual(expect.objectContaining(orgParams));
        expect(result.primaryUserId).toEqual(primaryUser._id);
        expect(result.users.length).toEqual(3);
        compareUsers(result.users[0], user);
        compareUsers(result.users[1], nurse);
        compareUsers(result.users[2], primaryUser);
      },
    );
  });

  describe('getMembers', () => {
    it('should return empty list for non existing orgId', async () => {
      const result = await service.getByOrg(generateId());
      expect(result).toEqual([]);
    });

    it('should return only 2 members which are within an orgId', async () => {
      const { _id: primaryUserId } = await modelUser.create(generateCreateRawUserParams());
      const { _id: orgId1 } = await modelOrg.create(generateOrgParams());
      const { _id: orgId2 } = await modelOrg.create(generateOrgParams());

      const { id: memberId1a } = await generateBasicMember({
        primaryUserId,
        usersIds: [primaryUserId],
        orgId: orgId1,
      });
      const { id: memberId1b } = await generateBasicMember({
        primaryUserId,
        usersIds: [primaryUserId],
        orgId: orgId1,
      });
      await generateBasicMember({ primaryUserId, usersIds: [primaryUserId], orgId: orgId2 });

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
      const { _id: primaryUserId } = await modelUser.create(generateCreateRawUserParams());
      const { _id: orgId1 } = await modelOrg.create(generateOrgParams());
      const { _id: orgId2 } = await modelOrg.create(generateOrgParams());

      const { id: memberId1a } = await generateBasicMember({
        primaryUserId,
        usersIds: [primaryUserId],
        orgId: orgId1,
      });
      const { id: memberId1b } = await generateBasicMember({
        primaryUserId,
        usersIds: [primaryUserId],
        orgId: orgId1,
      });
      const { id: memberId2 } = await generateBasicMember({
        primaryUserId,
        usersIds: [primaryUserId],
        orgId: orgId2,
      });

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
      const { _id: primaryUserId } = await modelUser.create(generateCreateRawUserParams());
      const { _id: orgId } = await modelOrg.create(generateOrgParams());

      const deviceId = datatype.uuid();
      const { id: memberId } = await generateBasicMember({
        primaryUserId,
        usersIds: [primaryUserId],
        orgId,
        deviceId,
      });

      const result = await service.getByOrg(orgId);
      const member = await service.getByDeviceId(deviceId);
      const primaryUser = await modelUser.findOne({ _id: primaryUserId });

      expect(result.length).toEqual(1);
      expect(result[0]).toEqual(
        expect.objectContaining({
          id: memberId,
          name: `${member.firstName} ${member.lastName}`,
          phone: member.phone,
          dischargeDate: null,
          adherence: 0,
          wellbeing: 0,
          createdAt: member.createdAt,
          goalsCount: 0,
          actionItemsCount: 0,
          primaryUser: expect.any(Object),
          nextAppointment: undefined,
          appointmentsCount: 0,
        }),
      );
      expect(primaryUser['title']).toEqual(result[0].primaryUser.title);
      expect(primaryUser._id).toEqual(result[0].primaryUser['_id']);
    });

    it('should handle member with all values', async () => {
      const { _id: primaryUserId } = await modelUser.create(generateCreateRawUserParams());
      const { _id: orgId } = await modelOrg.create(generateOrgParams());

      const deviceId = datatype.uuid();
      const dischargeDate = generateDateOnly(date.future(1));
      const createMemberParams = generateCreateMemberParams({
        primaryUserId,
        usersIds: [primaryUserId],
        orgId,
        deviceId,
        dischargeDate,
      });

      const { id: memberId } = await service.insert(createMemberParams);
      await service.insertGoal({
        createTaskParams: generateCreateTaskParams({ memberId }),
        status: TaskStatus.pending,
      });
      await service.insertActionItem({
        createTaskParams: generateCreateTaskParams({ memberId }),
        status: TaskStatus.pending,
      });
      await service.insertActionItem({
        createTaskParams: generateCreateTaskParams({ memberId }),
        status: TaskStatus.pending,
      });

      const result = await service.getByOrg(orgId);
      const member = await service.getByDeviceId(deviceId);
      const primaryUser = await modelUser.findById(primaryUserId);

      expect(result.length).toEqual(1);
      expect(result[0]).toEqual(
        expect.objectContaining({
          id: memberId,
          name: `${member.firstName} ${member.lastName}`,
          phone: member.phone,
          dischargeDate: member.dischargeDate,
          adherence: 0,
          wellbeing: 0,
          createdAt: member.createdAt,
          goalsCount: 1,
          actionItemsCount: 2,
          primaryUser: expect.any(Object),
          nextAppointment: undefined,
          appointmentsCount: 0,
        }),
      );

      expect(primaryUser['title']).toEqual(result[0].primaryUser.title);
      expect(primaryUser._id).toEqual(result[0].primaryUser['_id']);
    });
  });

  const generateBasicMember = async (createMemberParamsInput?): Promise<Identifier> => {
    const createMemberParams = generateCreateMemberParams(createMemberParamsInput);
    return service.insert(createMemberParams);
  };

  describe('getMembersAppointments', () => {
    it('should return empty array on members with orgId and no appointments', async () => {
      const { _id: primaryUserId } = await modelUser.create(generateCreateRawUserParams());
      const { _id: orgId } = await modelOrg.create(generateOrgParams());

      await generateBasicMember({ primaryUserId, usersIds: [primaryUserId], orgId });
      await generateBasicMember({ primaryUserId, usersIds: [primaryUserId], orgId });
      await generateBasicMember({ primaryUserId, usersIds: [primaryUserId], orgId });

      const result = await service.getMembersAppointments(orgId);
      expect(result).toEqual([]);
    });

    it('should return members with by orgId and appointments for each', async () => {
      const primaryUserParams = {
        firstName: faker.name.firstName(),
        lastName: faker.name.lastName(),
      };
      const { _id: primaryUserId } = await modelUser.create(
        generateCreateRawUserParams({ ...primaryUserParams }),
      );
      const { _id: orgId } = await modelOrg.create(generateOrgParams());

      const member1AppointmentsCount = 3;
      const member1 = await generateMemberAndAppointment({
        primaryUserId,
        orgId,
        numberOfAppointments: member1AppointmentsCount,
      });
      const member2AppointmentsCount = 4;
      const member2 = await generateMemberAndAppointment({
        primaryUserId,
        orgId,
        numberOfAppointments: member2AppointmentsCount,
      });

      const result = await service.getMembersAppointments(orgId);
      expect(result.length).toEqual(member1AppointmentsCount + member2AppointmentsCount);
      expect(result).toEqual(
        expect.arrayContaining([
          {
            memberId: member1.id,
            userId: primaryUserId,
            memberName: `${member1.firstName} ${member1.lastName}`,
            userName: `${primaryUserParams.firstName} ${primaryUserParams.lastName}`,
            start: expect.any(Date),
            end: expect.any(Date),
          },
          {
            memberId: member2.id,
            userId: primaryUserId,
            memberName: `${member2.firstName} ${member2.lastName}`,
            userName: `${primaryUserParams.firstName} ${primaryUserParams.lastName}`,
            start: expect.any(Date),
            end: expect.any(Date),
          },
        ]),
      );
    });

    it('should exclude non org members from results', async () => {
      const primaryUserParams = {
        firstName: faker.name.firstName(),
        lastName: faker.name.lastName(),
      };
      const { _id: primaryUserId } = await modelUser.create(
        generateCreateRawUserParams({ ...primaryUserParams }),
      );
      const { _id: orgId1 } = await modelOrg.create(generateOrgParams());
      const { _id: orgId2 } = await modelOrg.create(generateOrgParams());

      const memberAppointmentsCount = 2;
      const member = await generateMemberAndAppointment({
        primaryUserId,
        orgId: orgId1,
        numberOfAppointments: memberAppointmentsCount,
      });
      await generateMemberAndAppointment({
        primaryUserId,
        orgId: orgId2,
        numberOfAppointments: 1,
      });

      const result = await service.getMembersAppointments(orgId1);
      expect(result.length).toEqual(memberAppointmentsCount);
      expect(result).toEqual(
        expect.arrayContaining([
          {
            memberId: member.id,
            userId: primaryUserId,
            memberName: `${member.firstName} ${member.lastName}`,
            userName: `${primaryUserParams.firstName} ${primaryUserParams.lastName}`,
            start: expect.any(Date),
            end: expect.any(Date),
          },
        ]),
      );
    });

    it('should sort results by start timestamp desc', async () => {
      const { _id: primaryUserId } = await modelUser.create(generateCreateRawUserParams());
      const { _id: orgId } = await modelOrg.create(generateOrgParams());

      const member1AppointmentsCount = 3;
      await generateMemberAndAppointment({
        primaryUserId,
        orgId,
        numberOfAppointments: member1AppointmentsCount,
      });
      const member2AppointmentsCount = 4;
      await generateMemberAndAppointment({
        primaryUserId,
        orgId,
        numberOfAppointments: member2AppointmentsCount,
      });

      const result = await service.getMembersAppointments(orgId);
      const isSorted = result
        .map((item) => item.start)
        .every((v, i, a) => !i || a[i - 1].getTime() >= v.getTime());

      expect(result.length).toEqual(member1AppointmentsCount + member2AppointmentsCount);
      expect(isSorted).toBeTruthy();
    });

    it('should include only scheduled appointments', async () => {
      const { _id: primaryUserId } = await modelUser.create(generateCreateRawUserParams());
      const { _id: orgId } = await modelOrg.create(generateOrgParams());

      const numberOfAppointments = 1;
      const { id } = await generateMemberAndAppointment({
        primaryUserId,
        orgId,
        numberOfAppointments,
      });

      await modelAppointment.create({
        ...generateRequestAppointmentParams({ memberId: id, userId: primaryUserId }),
      });

      const result = await service.getMembersAppointments(orgId);
      expect(result.length).toEqual(numberOfAppointments);
      expect(result[0]).toEqual(expect.objectContaining({ memberId: id, userId: primaryUserId }));
    });

    it('should not take longer than 2 seconds to query with no filter orgId', async () => {
      await service.getMembersAppointments();
    }, 2000);

    const generateMemberAndAppointment = async ({ primaryUserId, orgId, numberOfAppointments }) => {
      const params = { firstName: faker.name.firstName(), lastName: faker.name.lastName() };
      const { id } = await generateBasicMember({
        primaryUserId,
        usersIds: [primaryUserId],
        orgId,
        ...params,
      });

      await Promise.all(
        Array.from(Array(numberOfAppointments)).map(
          async () =>
            await modelAppointment.create({
              ...generateScheduleAppointmentParams({ memberId: id, userId: primaryUserId }),
              status: AppointmentStatus.scheduled,
            }),
        ),
      );

      return { id, ...params };
    };
  });

  describe('insert', () => {
    it('should insert a member without optional params + validate all fields', async () => {
      const primaryUser = await modelUser.create(generateCreateRawUserParams());
      const org = await modelOrg.create(generateOrgParams());

      const createMemberParams = generateCreateMemberParams({
        orgId: org._id,
        primaryUserId: primaryUser._id,
      });
      createMemberParams.zipCode = undefined;
      const { id } = await service.insert(createMemberParams);

      expect(id).not.toBeUndefined();

      const createdMember: any = await memberModel.findById(id);
      compareMembers({
        createdMember,
        createMemberParams,
        primaryUserId: primaryUser._id,
        orgId: org._id,
      });
      expect(createdMember.sex).toEqual(defaultMemberParams.sex);
      expect(createdMember.email).toBeUndefined();
      expect(createdMember.language).toEqual(defaultMemberParams.language);
      expect(createdMember.zipCode).toBeUndefined();
      expect(createdMember.dischargeDate).toBeUndefined();
      expect(createdMember.honorific).toEqual(defaultMemberParams.honorific);
    });

    it('should insert a member with all params + validate all insert fields', async () => {
      const primaryUser = await modelUser.create(generateCreateRawUserParams());
      const org = await modelOrg.create(generateOrgParams());

      const createMemberParams = generateCreateMemberParams({
        orgId: org._id,
        primaryUserId: primaryUser._id,
        sex: Sex.female,
        email: internet.email(),
        language: Language.es,
        zipCode: generateZipCode(),
        dischargeDate: generateDateOnly(date.future(1)),
        honorific: Honorific.Dr,
      });
      const { id } = await service.insert(createMemberParams);

      expect(id).not.toBeUndefined();

      const createdMember: any = await memberModel.findById(id);
      compareMembers({
        createdMember,
        createMemberParams,
        primaryUserId: primaryUser._id,
        orgId: org._id,
      });
      expect(createdMember.sex).toEqual(createMemberParams.sex);
      expect(createdMember.email).toEqual(createMemberParams.email);
      expect(createdMember.language).toEqual(createMemberParams.language);
      expect(createdMember.zipCode).toEqual(createMemberParams.zipCode);
      expect(createdMember.dischargeDate).toEqual(createMemberParams.dischargeDate);
      expect(createdMember.honorific).toEqual(createMemberParams.honorific);
    });

    const compareMembers = ({ createdMember, createMemberParams, primaryUserId, orgId }) => {
      expect(createdMember.phone).toEqual(createMemberParams.phone);
      expect(createdMember.deviceId).toEqual(createMemberParams.deviceId);
      expect(createdMember.firstName).toEqual(createMemberParams.firstName);
      expect(createdMember.lastName).toEqual(createMemberParams.lastName);
      expect(createdMember.dateOfBirth).toEqual(createMemberParams.dateOfBirth);
      expect(createdMember.primaryUserId).toEqual(primaryUserId);
      expect(createdMember.org).toEqual(orgId);
      expect(createdMember.createdAt).toEqual(expect.any(Date));
    };

    it('should check that createdAt and updatedAt exists in the collection', async () => {
      const primaryUser = await modelUser.create(generateCreateRawUserParams());
      const org = await modelOrg.create(generateOrgParams());

      const createMemberParams = generateCreateMemberParams({
        orgId: org._id,
        primaryUserId: primaryUser._id,
      });
      const { id } = await service.insert(createMemberParams);

      const createdMember: any = await memberModel.findById(id);
      expect(createdMember.createdAt).toEqual(expect.any(Date));
      expect(createdMember.updatedAt).toEqual(expect.any(Date));
    });

    it('should remove not nullable optional params if null is passed', async () => {
      const primaryUser = await modelUser.create(generateCreateRawUserParams());
      const org = await modelOrg.create(generateOrgParams());

      const createMemberParams = generateCreateMemberParams({
        orgId: org._id,
        primaryUserId: primaryUser._id,
      });

      NotNullableMemberKeys.forEach((key) => {
        createMemberParams[key] = null;
      });

      createMemberParams.firstName = faker.name.firstName();
      createMemberParams.lastName = faker.name.lastName();
      createMemberParams.dateOfBirth = generateDateOnly(faker.date.past());

      const { id } = await service.insert(createMemberParams);
      const createdObject = await memberModel.findById(id);

      NotNullableMemberKeys.forEach((key) => {
        expect(createdObject).not.toHaveProperty(key, null);
      });
    });

    it('should insert a member even with primaryUser not exists', async () => {
      const createMemberParams: CreateMemberParams = generateCreateMemberParams({
        orgId: generateId(),
        primaryUserId: v4(),
      });
      const result = await service.insert(createMemberParams);

      expect(result.id).not.toBeUndefined();
    });

    it('should fail to insert an already existing member', async () => {
      const createMemberParams = generateCreateMemberParams({
        orgId: generateId(),
        primaryUserId: v4(),
      });
      await service.insert(createMemberParams);

      await expect(service.insert(createMemberParams)).rejects.toThrow(
        Errors.get(ErrorType.memberPhoneAlreadyExists),
      );
    });
  });

  describe('update', () => {
    it('should throw when trying to update non existing member', async () => {
      await expect(service.update({ id: generateId(), language: Language.es })).rejects.toThrow(
        Errors.get(ErrorType.memberNotFound),
      );
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

    it('should not change no nullable params if null is passed', async () => {
      const primaryUser = await modelUser.create(generateCreateRawUserParams());
      const org = await modelOrg.create(generateOrgParams());

      const createMemberParams = generateCreateMemberParams({
        orgId: org._id,
        primaryUserId: primaryUser._id,
      });

      const { id } = await service.insert(createMemberParams);
      const beforeObject = await memberModel.findById(id);

      const updateMemberParams = generateUpdateMemberParams();
      NotNullableMemberKeys.forEach((key) => {
        updateMemberParams[key] = null;
      });

      await service.update({ ...updateMemberParams, id });
      const afterObject = await memberModel.findById(id);

      NotNullableMemberKeys.forEach((key) => {
        expect(beforeObject[key]).toEqual(afterObject[key]);
      });
    });

    const updateMember = async (updateMemberParams?: Omit<UpdateMemberParams, 'id'>) => {
      const primaryUser = await modelUser.create(generateCreateRawUserParams());
      const org = await modelOrg.create(generateOrgParams());

      const createMemberParams = generateCreateMemberParams({
        orgId: org._id,
        primaryUserId: primaryUser._id,
      });
      const { id } = await service.insert(createMemberParams);

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
      const { id } = await service.insertGoal({ createTaskParams, status: TaskStatus.pending });

      expect(id).toEqual(expect.any(Types.ObjectId));
    });
  });

  describe('updateGoalStatus', () => {
    it('should update an existing goal status', async () => {
      const createTaskParams = generateCreateTaskParams();
      const { id } = await service.insertGoal({ createTaskParams, status: TaskStatus.pending });

      await service.updateGoalStatus({ id, status: TaskStatus.reached });
    });

    it('should not be able to update status for a non existing goal', async () => {
      await expect(service.updateGoalStatus(generateUpdateTaskStatusParams())).rejects.toThrow(
        Errors.get(ErrorType.memberGoalIdNotFound),
      );
    });
  });

  describe('insertActionItem', () => {
    it('should insert an action item', async () => {
      const createTaskParams = generateCreateTaskParams();
      const { id } = await service.insertActionItem({
        createTaskParams,
        status: TaskStatus.pending,
      });

      expect(id).toEqual(expect.any(Types.ObjectId));
    });
  });

  describe('updateActionItemStatus', () => {
    it('should update an existing action item status', async () => {
      const createTaskParams = generateCreateTaskParams();
      const { id } = await service.insertActionItem({
        createTaskParams,
        status: TaskStatus.pending,
      });

      await service.updateActionItemStatus({ id, status: TaskStatus.reached });
    });

    it('should not be able to update status for a non existing action item', async () => {
      await expect(
        service.updateActionItemStatus(generateUpdateTaskStatusParams()),
      ).rejects.toThrow(Errors.get(ErrorType.memberActionItemIdNotFound));
    });
  });

  describe('setGeneralNotes', () => {
    it('should set general notes for a member', async () => {
      const { _id: primaryUserId } = await modelUser.create(generateCreateRawUserParams());
      const { _id: orgId } = await modelOrg.create(generateOrgParams());

      const { id: memberId } = await generateBasicMember({
        primaryUserId,
        usersIds: [primaryUserId],
        orgId,
      });

      const generalNotes = generateSetGeneralNotesParams({ memberId });
      await service.setGeneralNotes(generalNotes);

      const result: any = await memberModel.findById(memberId);

      expect(result.generalNotes).toEqual(generalNotes.note);
    });

    it('should throw error on set general notes for a non existing member', async () => {
      const generalNotes = generateSetGeneralNotesParams();
      await expect(service.setGeneralNotes(generalNotes)).rejects.toThrow(
        Errors.get(ErrorType.memberNotFound),
      );
    });
  });

  describe('getMemberConfig', () => {
    it('should create memberConfig on memberCreate', async () => {
      const { _id: primaryUserId } = await modelUser.create(generateCreateRawUserParams());
      const { _id: orgId } = await modelOrg.create(generateOrgParams());

      const member = generateCreateMemberParams({
        primaryUserId,
        usersIds: [primaryUserId],
        orgId,
      });
      const craetedMember = await service.insert(member);
      const CreatedConfigMember = await service.getMemberConfig(craetedMember.id);

      expect(craetedMember.id).toEqual(CreatedConfigMember.memberId);
    });

    it('should fail to fetch member config on non existing member', async () => {
      await expect(service.getMemberConfig(generateId())).rejects.toThrow(
        Errors.get(ErrorType.memberNotFound),
      );
    });

    it('should insert member config on member insert, and fetch it', async () => {
      const { _id: primaryUserId } = await modelUser.create(generateCreateRawUserParams());
      const { _id: orgId } = await modelOrg.create(generateOrgParams());

      const createMemberParams = generateCreateMemberParams({
        primaryUserId,
        usersIds: [primaryUserId],
        orgId,
      });

      const { id } = await service.insert(createMemberParams);
      const memberConfig = await service.getMemberConfig(id);

      expect(memberConfig).toEqual(
        expect.objectContaining({
          memberId: id,
          externalUserId: expect.any(String),
        }),
      );
    });
  });
});
