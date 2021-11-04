import { Test, TestingModule } from '@nestjs/testing';
import * as config from 'config';
import * as faker from 'faker';
import { datatype, date, internet } from 'faker';
import { Model, Types, model } from 'mongoose';
import { RecordingType } from '../../src/common/interfaces.dto';
import { v4 } from 'uuid';
import {
  Appointment,
  AppointmentDto,
  AppointmentModule,
  AppointmentStatus,
} from '../../src/appointment';
import { ErrorType, Errors, Language, Platform } from '../../src/common';
import {
  ActionItem,
  ActionItemDto,
  CreateMemberParams,
  Goal,
  GoalDto,
  Member,
  MemberDto,
  MemberModule,
  MemberService,
  NotNullableMemberKeys,
  Sex,
  TaskStatus,
  UpdateMemberParams,
  defaultMemberParams,
} from '../../src/member';
import { Org, OrgDto } from '../../src/org';
import { User, UserDto } from '../../src/user';
import {
  compareUsers,
  dbConnect,
  dbDisconnect,
  defaultModules,
  generateCreateMemberParams,
  generateCreateRawUserParams,
  generateCreateTaskParams,
  generateDateOnly,
  generateId,
  generateObjectId,
  generateOrgParams,
  generatePhone,
  generateRequestAppointmentParams,
  generateScheduleAppointmentParams,
  generateSetGeneralNotesParams,
  generateUpdateMemberConfigParams,
  generateUpdateMemberParams,
  generateUpdateRecordingParams,
  generateUpdateTaskStatusParams,
  generateZipCode,
} from '../index';

describe('MemberService', () => {
  let module: TestingModule;
  let service: MemberService;
  let memberModel: Model<typeof MemberDto>;
  let modelUser: Model<typeof UserDto>;
  let modelOrg: Model<typeof OrgDto>;
  let modelGoal: Model<typeof GoalDto>;
  let modelActionItem: Model<typeof ActionItemDto>;
  let modelAppointment: Model<typeof AppointmentDto>;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: defaultModules().concat(MemberModule, AppointmentModule),
    }).compile();

    service = module.get<MemberService>(MemberService);

    memberModel = model(Member.name, MemberDto);
    modelUser = model(User.name, UserDto);
    modelOrg = model(Org.name, OrgDto);
    modelGoal = model(Goal.name, GoalDto);
    modelActionItem = model(ActionItem.name, ActionItemDto);
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
        const primaryUser = await modelUser.create(primaryUserParams);
        const orgParams = generateOrgParams();
        const org = await modelOrg.create(orgParams);

        const deviceId = datatype.uuid();
        const member = generateCreateMemberParams({ orgId: generateId() });

        const { _id } = await memberModel.create({
          phone: member.phone,
          deviceId,
          firstName: member.firstName,
          lastName: member.lastName,
          org: generateObjectId(org.id),
          primaryUserId: primaryUser.id,
          users: [primaryUser.id],
        });

        const result = await params.method(params.field === 'context' ? deviceId : _id);

        expect(result.id).toEqual(_id.toString());
        expect(result.phone).toEqual(member.phone);
        expect(result.deviceId).toEqual(deviceId);
        expect(result.firstName).toEqual(member.firstName);
        expect(result.lastName).toEqual(member.lastName);
        expect(result.org).toEqual(expect.objectContaining(orgParams));
        expect(result.primaryUserId).toEqual(primaryUser._id);
        expect(result.users.length).toEqual(1);
        compareUsers(result.users[0], primaryUser);
      },
    );

    it('should get member by phone', async () => {
      const primaryUserParams = generateCreateRawUserParams();
      const primaryUser = await modelUser.create(primaryUserParams);
      const orgParams = generateOrgParams();
      const org = await modelOrg.create(orgParams);

      const deviceId = datatype.uuid();
      const member = generateCreateMemberParams({ orgId: generateId() });

      const { _id } = await memberModel.create({
        phone: member.phone,
        deviceId,
        firstName: member.firstName,
        lastName: member.lastName,
        org: generateObjectId(org.id),
        primaryUserId: primaryUser.id,
        users: [primaryUser.id],
      });

      const result = await service.getByPhone(member.phone);

      expect(result.id).toEqual(_id.toString());
      expect(result.phone).toEqual(member.phone);
      expect(result.deviceId).toEqual(deviceId);
      expect(result.firstName).toEqual(member.firstName);
      expect(result.lastName).toEqual(member.lastName);
      expect(result.org).toEqual(expect.objectContaining(orgParams));
      expect(result.primaryUserId).toEqual(primaryUser._id);
      expect(result.users.length).toEqual(1);
      compareUsers(result.users[0], primaryUser);
    });

    it('should get member by Secondary phone', async () => {
      const primaryUserParams = generateCreateRawUserParams();
      const primaryUser = await modelUser.create(primaryUserParams);
      const orgParams = generateOrgParams();
      const org = await modelOrg.create(orgParams);

      const deviceId = datatype.uuid();
      const member = generateCreateMemberParams({ orgId: generateId() });

      const { _id } = await memberModel.create({
        phone: generatePhone(),
        phoneSecondary: member.phone,
        deviceId,
        firstName: member.firstName,
        lastName: member.lastName,
        org: generateObjectId(org.id),
        primaryUserId: primaryUser.id,
        users: [primaryUser.id],
      });

      const result = await service.getByPhone(member.phone);

      expect(result.id).toEqual(_id.toString());
      expect(result.phoneSecondary).toEqual(member.phone);
      expect(result.deviceId).toEqual(deviceId);
      expect(result.firstName).toEqual(member.firstName);
      expect(result.lastName).toEqual(member.lastName);
      expect(result.org).toEqual(expect.objectContaining(orgParams));
      expect(result.primaryUserId).toEqual(primaryUser._id);
      expect(result.users.length).toEqual(1);
      compareUsers(result.users[0], primaryUser);
    });
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

      const { id: memberId1a } = await service.insert(
        generateCreateMemberParams({ orgId: orgId1 }),
        primaryUserId,
      );
      const { id: memberId1b } = await service.insert(
        generateCreateMemberParams({ orgId: orgId1 }),
        primaryUserId,
      );
      await service.insert(generateCreateMemberParams({ orgId: orgId2 }), primaryUserId);

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

      const { id: memberId1a } = await service.insert(
        generateCreateMemberParams({ orgId: orgId1 }),
        primaryUserId,
      );
      const { id: memberId1b } = await service.insert(
        generateCreateMemberParams({ orgId: orgId1 }),
        primaryUserId,
      );
      const { id: memberId2 } = await service.insert(
        generateCreateMemberParams({ orgId: orgId2 }),
        primaryUserId,
      );

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

      const { id: memberId } = await service.insert(
        generateCreateMemberParams({ orgId }),
        primaryUserId,
      );

      const result = await service.getByOrg(orgId);
      const member = await service.get(memberId);
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

      const dischargeDate = generateDateOnly(date.future(1));
      const { id: memberId } = await service.insert(
        generateCreateMemberParams({ orgId, dischargeDate }),
        primaryUserId,
      );

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
      const member = await service.get(memberId);
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

  describe('getMembersAppointments', () => {
    it('should return empty array on members with orgId and no appointments', async () => {
      const { _id: primaryUserId } = await modelUser.create(generateCreateRawUserParams());
      const { _id: orgId } = await modelOrg.create(generateOrgParams());

      await service.insert(generateCreateMemberParams({ orgId }), primaryUserId);
      await service.insert(generateCreateMemberParams({ orgId }), primaryUserId);
      await service.insert(generateCreateMemberParams({ orgId }), primaryUserId);

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
      const { id } = await service.insert(
        generateCreateMemberParams({ orgId, ...params }),
        primaryUserId,
      );

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
      });
      createMemberParams.zipCode = undefined;
      const { id } = await service.insert(createMemberParams, primaryUser._id);

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
        sex: Sex.female,
        email: internet.email(),
        language: Language.es,
        zipCode: generateZipCode(),
        dischargeDate: generateDateOnly(date.future(1)),
        honorific: config.get('contents.honorific.dr'),
      });
      const { id } = await service.insert(createMemberParams, primaryUser._id);

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
      const id = await generateMember();

      const createdMember: any = await memberModel.findById(id);
      expect(createdMember.createdAt).toEqual(expect.any(Date));
      expect(createdMember.updatedAt).toEqual(expect.any(Date));
    });

    it('should remove not nullable optional params if null is passed', async () => {
      const primaryUser = await modelUser.create(generateCreateRawUserParams());
      const org = await modelOrg.create(generateOrgParams());

      const createMemberParams = generateCreateMemberParams({ orgId: org._id });

      NotNullableMemberKeys.forEach((key) => {
        createMemberParams[key] = null;
      });

      createMemberParams.firstName = faker.name.firstName();
      createMemberParams.lastName = faker.name.lastName();
      createMemberParams.dateOfBirth = generateDateOnly(faker.date.past());

      const { id } = await service.insert(createMemberParams, primaryUser._id);
      const createdObject = await memberModel.findById(id);

      NotNullableMemberKeys.forEach((key) => {
        expect(createdObject).not.toHaveProperty(key, null);
      });
    });

    it('should insert a member even with primaryUser not exists', async () => {
      const createMemberParams: CreateMemberParams = generateCreateMemberParams({
        orgId: generateId(),
      });
      const result = await service.insert(createMemberParams, v4());

      expect(result.id).not.toBeUndefined();
    });

    it('should fail to insert an already existing member', async () => {
      const primaryUserId = v4();
      const createMemberParams = generateCreateMemberParams({ orgId: generateId() });
      await service.insert(createMemberParams, primaryUserId);

      await expect(service.insert(createMemberParams, primaryUserId)).rejects.toThrow(
        Errors.get(ErrorType.memberPhoneAlreadyExists),
      );
    });
  });

  describe('archive', () => {
    it('should throw an error when trying to archive non existing member', async () => {
      await expect(service.moveMemberToArchive(generateId())).rejects.toThrow(
        Errors.get(ErrorType.memberNotFound),
      );
    });

    // eslint-disable-next-line max-len
    it('should move member and memberConfig from members and memberconfigs collection', async () => {
      const memberId = await generateMember();
      const member = await service.get(memberId);
      const memberConfig = await service.getMemberConfig(memberId);

      const result = await service.moveMemberToArchive(memberId);
      expect(result.member).toEqual(member);
      expect(result.memberConfig).toEqual(memberConfig);

      await expect(service.get(memberId)).rejects.toThrow(Errors.get(ErrorType.memberNotFound));
      await expect(service.getMemberConfig(memberId)).rejects.toThrow(
        Errors.get(ErrorType.memberNotFound),
      );
    });
  });

  describe('delete', () => {
    it('should throw an error when trying to delete non existing member', async () => {
      await expect(service.moveMemberToArchive(generateId())).rejects.toThrow(
        Errors.get(ErrorType.memberNotFound),
      );
    });

    it('should delete member', async () => {
      const memberId = await generateMember();
      const member = await service.get(memberId);
      const memberConfig = await service.getMemberConfig(memberId);
      const result = await service.deleteMember(memberId);
      expect(result.member).toEqual(member);
      expect(result.memberConfig).toEqual(memberConfig);
      await expect(service.get(memberId)).rejects.toThrow(Errors.get(ErrorType.memberNotFound));
      await expect(service.getMemberConfig(memberId)).rejects.toThrow(
        Errors.get(ErrorType.memberNotFound),
      );
      for (let index = 0; index < member.goals.length; index++) {
        const goalResult = await modelGoal.findById(member.goals[index]);
        expect(goalResult).toBeNull();
      }
      for (let index = 0; index < member.actionItems.length; index++) {
        const actionItemsResult = await modelActionItem.findById(member.actionItems[index]);
        expect(actionItemsResult).toBeNull();
      }
      const appointmentResult = await modelAppointment.find({
        memberId: new Types.ObjectId(memberId),
      });
      expect(appointmentResult).toEqual([]);
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
      delete params.authId;
      await updateMember(params);
    });

    it('should not change no nullable params if null is passed', async () => {
      const id = await generateMember();
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

    const updateMember = async (updateMemberParams?: Omit<UpdateMemberParams, 'id' | 'authId'>) => {
      const id = await generateMember();

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
      const memberId = await generateMember();

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

  describe('updateMemberConfig', () => {
    it('should update memberConfig multiple times', async () => {
      //1st memberConfig is inserted in generateMember with externalUserId only
      const id = await generateMember();
      const params1 = await generateUpdateMemberConfigParams({
        memberId: generateId(id),
        platform: Platform.android,
        isPushNotificationsEnabled: true,
        isAppointmentsReminderEnabled: true,
        isRecommendationsEnabled: false,
      });

      await service.updateMemberConfig(params1);

      const configs1 = await service.getMemberConfig(id);
      expect(configs1.externalUserId).toEqual(expect.any(String));
      expect(configs1.isPushNotificationsEnabled).toEqual(params1.isPushNotificationsEnabled);
      expect(configs1.isAppointmentsReminderEnabled).toEqual(params1.isAppointmentsReminderEnabled);
      expect(configs1.isRecommendationsEnabled).toEqual(params1.isRecommendationsEnabled);
      expect(configs1.platform).toEqual(params1.platform);

      const params2 = await generateUpdateMemberConfigParams({
        memberId: generateId(id),
        platform: Platform.web,
        isPushNotificationsEnabled: false,
        isAppointmentsReminderEnabled: false,
        isRecommendationsEnabled: true,
      });
      params2.memberId = id;
      await service.updateMemberConfig(params2);

      const configs2 = await service.getMemberConfig(id);
      expect(configs1.memberId).toEqual(configs2.memberId);
      expect(configs1.externalUserId).toEqual(configs2.externalUserId);
      expect(configs2.platform).toEqual(params2.platform);
      expect(configs2.isPushNotificationsEnabled).toEqual(params2.isPushNotificationsEnabled);
      expect(configs2.isAppointmentsReminderEnabled).toEqual(params2.isAppointmentsReminderEnabled);
      expect(configs2.isRecommendationsEnabled).toEqual(params2.isRecommendationsEnabled);
    });

    it('should update only isPushNotificationsEnabled', async () => {
      //1st memberConfig is inserted in generateMember with externalUserId only
      const id = await generateMember();

      const params = {
        memberId: id,
        platform: Platform.android,
        isPushNotificationsEnabled: true,
      };
      params.memberId = id;
      await service.updateMemberConfig(params);

      let configs = await service.getMemberConfig(id);
      expect(configs.externalUserId).toEqual(expect.any(String));
      expect(configs.isPushNotificationsEnabled).toEqual(params.isPushNotificationsEnabled);
      expect(configs.platform).toEqual(params.platform);

      await service.updateMemberConfig({
        memberId: id,
        platform: Platform.android,
        isPushNotificationsEnabled: true,
      });

      configs = await service.getMemberConfig(id);
      expect(configs.isPushNotificationsEnabled).toEqual(true);
    });

    test.each([
      { isPushNotificationsEnabled: null },
      { isAppointmentsReminderEnabled: null },
      { isRecommendationsEnabled: null },
    ])('should not override %p since it is not define in input', async (field) => {
      const id = await generateMember();

      let params = generateUpdateMemberConfigParams({ memberId: generateId(id) });
      params = { ...params, ...field };
      await service.updateMemberConfig(params);

      const configs = await service.getMemberConfig(id);
      expect(configs[Object.keys(field)[0]]).toEqual(false);
    });
  });

  describe('getMemberConfig', () => {
    it('should create memberConfig on memberCreate', async () => {
      const id = await generateMember();
      const CreatedConfigMember = await service.getMemberConfig(id);

      expect(id).toEqual(CreatedConfigMember.memberId);
    });

    it('should fail to fetch member config on non existing member', async () => {
      await expect(service.getMemberConfig(generateId())).rejects.toThrow(
        Errors.get(ErrorType.memberNotFound),
      );
    });

    it('should insert member config on member insert, and fetch it', async () => {
      const id = await generateMember();
      const memberConfig = await service.getMemberConfig(id);

      expect(memberConfig).toEqual(
        expect.objectContaining({
          memberId: id,
          externalUserId: expect.any(String),
          platform: Platform.web,
        }),
      );
    });
  });

  describe('getArticlesPath', () => {
    it('should return the default path for a non existing drg', async () => {
      const id = await generateMember();
      const memberConfig = await service.getMemberConfig(id);

      expect(memberConfig.articlesPath).toEqual(config.get('articlesByDrg.default'));
    });

    it('should return the configured path for a configured drg', async () => {
      const id = await generateMember();
      const updateMemberParams = generateUpdateMemberParams({ id, drg: '123' });
      await service.update({ id, ...updateMemberParams });

      const memberConfig = await service.getMemberConfig(id);

      expect(memberConfig.articlesPath).toEqual(config.get('articlesByDrg.123'));
    });
  });

  describe('updateRecording + getRecordings', () => {
    it('should fail to update recording on non existing member', async () => {
      await expect(service.updateRecording(generateUpdateRecordingParams())).rejects.toThrow(
        Errors.get(ErrorType.memberNotFound),
      );
    });

    it('should fail to update an existing id for different member', async () => {
      const memberId1 = await generateMember();
      const recording1 = generateUpdateRecordingParams({ memberId: memberId1 });
      await service.updateRecording(recording1);

      const memberId2 = await generateMember();
      const recording2 = generateUpdateRecordingParams({ id: recording1.id, memberId: memberId2 });
      await expect(service.updateRecording(recording2)).rejects.toThrow(
        Errors.get(ErrorType.memberRecordingIdAlreadyExists),
      );
    });

    it('should update a member recording', async () => {
      const memberId = await generateMember();
      const recording = generateUpdateRecordingParams({ memberId });
      await service.updateRecording(recording);

      const recordings = await service.getRecordings(memberId);
      expect(recordings.length).toEqual(1);
      expect(recordings[0].id).toEqual(recording.id);
      expect(recordings[0]).toEqual(expect.objectContaining(recording));
    });

    it('should not override optional fields when not set from params', async () => {
      const memberId = await generateMember();
      const appointmentId = new Types.ObjectId(generateId());
      const recording1 = generateUpdateRecordingParams({
        memberId,
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        appointmentId: appointmentId as string,
        recordingType: RecordingType.phone,
      });
      await service.updateRecording(recording1);
      const recording2 = generateUpdateRecordingParams({ id: recording1.id, memberId });
      recording2.start = undefined;
      recording2.end = undefined;
      recording2.userId = undefined;
      recording2.phone = undefined;
      recording2.answered = undefined;
      recording2.recordingType = undefined;
      recording2.appointmentId = undefined;
      await service.updateRecording(recording2);

      const recordings = await service.getRecordings(memberId);
      expect(recordings.length).toEqual(1);
      expect(recordings[0]).toEqual(expect.objectContaining(recording1));
    });

    it('should multiple update members recordings', async () => {
      const memberId1 = await generateMember();
      const recording1a = generateUpdateRecordingParams({ memberId: memberId1 });
      await service.updateRecording(recording1a);
      const recording1b = generateUpdateRecordingParams({ memberId: memberId1 });
      recording1b.end = undefined;
      await service.updateRecording(recording1b);
      const memberId2 = await generateMember();
      const recording2 = generateUpdateRecordingParams({ memberId: memberId2 });
      await service.updateRecording(recording2);

      const recordings1 = await service.getRecordings(memberId1);
      expect(recordings1.length).toEqual(2);
      expect(recordings1[0]).toEqual(expect.objectContaining(recording1a));
      expect(recordings1[1]).toEqual(expect.objectContaining(recording1b));

      const recordings2 = await service.getRecordings(memberId2);
      expect(recordings2.length).toEqual(1);
      expect(recordings2[0]).toEqual(expect.objectContaining(recording2));
    });
  });

  describe('replaceUserForMember', () => {
    it('should fail to update on non existing member', async () => {
      const userId = generateId();
      const memberId = generateId();
      await expect(service.replaceUserForMember({ userId, memberId })).rejects.toThrow(
        Errors.get(ErrorType.memberNotFound),
      );
    });

    it('should throw an error if the new user equals the old user', async () => {
      const memberId = await generateMember();
      const member = await service.get(memberId);

      await expect(
        service.replaceUserForMember({ userId: member.primaryUserId, memberId }),
      ).rejects.toThrow(Errors.get(ErrorType.userIdOrEmailAlreadyExists));
    });

    it('should update the primary user and add new user to the users list', async () => {
      const memberId = await generateMember();
      const newUser = await modelUser.create(generateCreateRawUserParams());
      const oldMember = await service.get(memberId);

      const oldUserId = await service.replaceUserForMember({ userId: newUser._id, memberId });

      const updatedMember = await service.get(memberId);
      expect(updatedMember.primaryUserId).toEqual(newUser._id);
      expect(oldUserId).toEqual(oldMember.primaryUserId);
      compareUsers(updatedMember.users[updatedMember.users.length - 1], newUser);
    });
  });

  const generateMember = async (): Promise<string> => {
    const { _id: primaryUserId } = await modelUser.create(generateCreateRawUserParams());
    const { _id: orgId } = await modelOrg.create(generateOrgParams());
    const createMemberParams = generateCreateMemberParams({ orgId });

    const { id } = await service.insert(createMemberParams, primaryUserId);
    return id;
  };
});
