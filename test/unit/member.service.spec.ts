import {
  Honorific,
  Language,
  Platform,
  generatePhone,
  generateZipCode,
} from '@lagunahealth/pandora';
import { Test, TestingModule } from '@nestjs/testing';
import * as config from 'config';
import * as faker from 'faker';
import { datatype, date, internet } from 'faker';
import { Model, Types, model } from 'mongoose';
import { performance } from 'perf_hooks';
import {
  Appointment,
  AppointmentDocument,
  AppointmentDto,
  AppointmentModule,
  AppointmentStatus,
} from '../../src/appointment';
import { ErrorType, Errors, LoggerService, RecordingType } from '../../src/common';
import {
  ActionItem,
  ActionItemDto,
  ControlMember,
  ControlMemberDto,
  CreateMemberParams,
  Goal,
  GoalDto,
  ImageFormat,
  Journal,
  JournalDto,
  Member,
  MemberDto,
  MemberModule,
  MemberService,
  NotNullableMemberKeys,
  ReadmissionRisk,
  Sex,
  TaskStatus,
  UpdateMemberParams,
} from '../../src/member';
import { Org, OrgDto } from '../../src/org';
import { User, UserDto } from '../../src/user';
import {
  compareMembers,
  compareUsers,
  dbConnect,
  dbDisconnect,
  defaultModules,
  generateAddCaregiverParams,
  generateCreateMemberParams,
  generateCreateTaskParams,
  generateCreateUserParams,
  generateDateOnly,
  generateGetMemberUploadJournalImageLinkParams,
  generateId,
  generateObjectId,
  generateOrgParams,
  generateRequestAppointmentParams,
  generateScheduleAppointmentParams,
  generateSetGeneralNotesParams,
  generateUpdateCaregiverParams,
  generateUpdateJournalTextParams,
  generateUpdateMemberConfigParams,
  generateUpdateMemberParams,
  generateUpdateRecordingParams,
  generateUpdateTaskStatusParams,
  mockLogger,
} from '../index';

describe('MemberService', () => {
  let module: TestingModule;
  let service: MemberService;
  let memberModel: Model<typeof MemberDto>;
  let controlMemberModel: Model<typeof ControlMemberDto>;
  let modelUser: Model<typeof UserDto>;
  let modelOrg: Model<typeof OrgDto>;
  let modelGoal: Model<typeof GoalDto>;
  let modelActionItem: Model<typeof ActionItemDto>;
  let modelJournal: Model<typeof JournalDto>;
  let modelAppointment: Model<typeof AppointmentDto>;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: defaultModules().concat(MemberModule, AppointmentModule),
    }).compile();

    service = module.get<MemberService>(MemberService);
    mockLogger(module.get<LoggerService>(LoggerService));

    memberModel = model(Member.name, MemberDto);
    controlMemberModel = model(ControlMember.name, ControlMemberDto);
    modelUser = model(User.name, UserDto);
    modelOrg = model(Org.name, OrgDto);
    modelGoal = model(Goal.name, GoalDto);
    modelActionItem = model(ActionItem.name, ActionItemDto);
    modelJournal = model(Journal.name, JournalDto);
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
        const primaryUserParams = generateCreateUserParams();
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
        expect(result.primaryUserId.toString()).toEqual(primaryUser._id.toString());
        expect(result.users.length).toEqual(1);
        compareUsers(result.users[0], primaryUser);
      },
    );

    it('should get member by phone', async () => {
      const primaryUserParams = generateCreateUserParams();
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
      expect(result.primaryUserId.toString()).toEqual(primaryUser._id.toString());
      expect(result.users.length).toEqual(1);
      compareUsers(result.users[0], primaryUser);
    });

    it('should get member by Secondary phone', async () => {
      const primaryUserParams = generateCreateUserParams();
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
      expect(result.primaryUserId.toString()).toEqual(primaryUser._id.toString());
      expect(result.users.length).toEqual(1);
      compareUsers(result.users[0], primaryUser);
    });
  });

  describe('getMembers', () => {
    it('should return empty list for non existing orgId', async () => {
      const result = await service.getByOrg(generateId());
      expect(result).toEqual([]);
    });

    it('should return empty list for no members on org', async () => {
      const orgId = await generateOrg();
      const result = await service.getByOrg(orgId);
      expect(result).toEqual([]);
    });

    it('should return only 2 members which are within an orgId', async () => {
      const orgId1 = await generateOrg();
      const orgId2 = await generateOrg();

      const memberId1a = await generateMember(orgId1);
      const memberId1b = await generateMember(orgId1);

      await generateMember(orgId2);

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
      const orgId1 = await generateOrg();
      const orgId2 = await generateOrg();

      const memberId1a = await generateMember(orgId1);
      const memberId1b = await generateMember(orgId1);
      const memberId2 = await generateMember(orgId2);

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
      const primaryUserId = await generateUser();
      const orgId = await generateOrg();

      const memberId = await generateMember(orgId, primaryUserId);
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
      const primaryUserId = await generateUser();
      const orgId = await generateOrg();

      const dischargeDate = generateDateOnly(date.future(1));
      const { member: createdMember } = await service.insert(
        generateCreateMemberParams({ orgId, dischargeDate }),
        new Types.ObjectId(primaryUserId),
      );
      const memberId = createdMember.id;

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

    it('should return no nextAppointment on no scheduled appointments', async () => {
      const userId = await generateUser();
      const orgId = await generateOrg();
      const memberId = await generateMember(orgId);
      await generateAppointment({ memberId, userId, status: AppointmentStatus.done });

      const result = await service.getByOrg(orgId);
      expect(result.length).toEqual(1);
      expect(result[0]).toEqual(
        expect.objectContaining({
          nextAppointment: undefined,
          appointmentsCount: 1,
        }),
      );
    });

    /* eslint-disable-next-line max-len */
    it('should return most recent appointment (start time) when it was scheduled before', async () => {
      await testTwoAppointmentsWithGap(1);
    });

    /* eslint-disable-next-line max-len */
    it('should return most recent appointment (start time) when it was scheduled after', async () => {
      await testTwoAppointmentsWithGap(-1);
    });

    const testTwoAppointmentsWithGap = async (secondAppointmentGap: number) => {
      const userId = await generateUser();
      const orgId = await generateOrg();
      const memberId = await generateMember(orgId);

      // first appointment
      const start1 = new Date();
      start1.setHours(start1.getHours() + 2);
      const appointment1 = await generateAppointment({ memberId, userId, start: start1 });

      // second appointment
      const start2 = new Date();
      start2.setHours(start1.getHours() + secondAppointmentGap);
      const appointment2 = await generateAppointment({ memberId, userId, start: start2 });

      const result = await service.getByOrg(orgId);
      expect(result.length).toEqual(1);
      expect(result[0]).toEqual(
        expect.objectContaining({
          nextAppointment: secondAppointmentGap > 0 ? appointment1.start : appointment2.start,
          appointmentsCount: 2,
        }),
      );
    };

    /* eslint-disable-next-line max-len */
    it('should handle primaryUser and users appointments in nextAppointment calculations', async () => {
      const userId1 = await generateUser();
      const userId2 = await generateUser();
      const orgId = await generateOrg();

      const memberId = await generateMember(orgId);

      let startPrimaryUser = new Date();
      startPrimaryUser.setHours(startPrimaryUser.getHours() + 10);
      await generateAppointment({ userId: userId1, memberId, start: startPrimaryUser });
      startPrimaryUser = new Date();
      startPrimaryUser.setHours(startPrimaryUser.getHours() + 6);
      await generateAppointment({ userId: userId2, memberId, start: startPrimaryUser });

      const startUser1 = new Date();
      startUser1.setHours(startUser1.getHours() + 4);
      const appointment = await generateAppointment({
        userId: userId1,
        memberId,
        start: startUser1,
      });

      const startUser2 = new Date();
      startUser2.setHours(startUser2.getHours() + 8);
      await generateAppointment({ userId: userId2, memberId, start: startUser2 });

      const result = await service.getByOrg(orgId);
      expect(result.length).toEqual(1);
      expect(result[0]).toEqual(
        expect.objectContaining({
          nextAppointment: appointment.start,
          appointmentsCount: 4,
        }),
      );
    });

    it('should handle just users appointments in nextAppointment calculations', async () => {
      const userId = await generateUser();
      const orgId = await generateOrg();
      const memberId = await generateMember(orgId);

      const start = new Date();
      start.setHours(start.getHours() + 4);
      const appointment = await generateAppointment({ userId, memberId, start });

      const result = await service.getByOrg(orgId);
      expect(result.length).toEqual(1);
      expect(result[0]).toEqual(
        expect.objectContaining({
          nextAppointment: appointment.start,
          appointmentsCount: 1,
        }),
      );
    });

    /* eslint-disable-next-line max-len */
    it('should not take longer than 1 second to process 10 members with 3 appointments each', async () => {
      const userId = await generateUser();
      const orgId = await generateOrg();

      for (let i = 0; i < 10; i++) {
        const memberId = await generateMember(orgId);
        await generateAppointment({ memberId, userId });
        await generateAppointment({ memberId, userId });
        await generateAppointment({ memberId, userId });
      }

      const startTime = performance.now();
      const result = await service.getByOrg(orgId);
      const endTime = performance.now();
      expect(result.length).toEqual(10);
      expect(endTime - startTime).toBeLessThan(1000);
    }, 15000);
  });

  describe('getMembersAppointments', () => {
    it('should return empty array on members with orgId and no appointments', async () => {
      const orgId = await generateOrg();
      await generateMember(orgId);
      await generateMember(orgId);
      await generateMember(orgId);

      const result = await service.getMembersAppointments(orgId);
      expect(result).toEqual([]);
    });

    it('should return members with by orgId and appointments for each', async () => {
      const primaryUserParams = {
        firstName: faker.name.firstName(),
        lastName: faker.name.lastName(),
      };
      const { _id: primaryUserId } = await modelUser.create(
        generateCreateUserParams({ ...primaryUserParams }),
      );
      const orgId = await generateOrg();

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
        generateCreateUserParams({ ...primaryUserParams }),
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
      const primaryUserId = await generateUser();
      const orgId = await generateOrg();

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
      const primaryUserId = await generateUser();
      const orgId = await generateOrg();

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
      const { member } = await service.insert(
        generateCreateMemberParams({ orgId, ...params }),
        primaryUserId,
      );

      await Promise.all(
        Array.from(Array(numberOfAppointments)).map(async () =>
          generateAppointment({ memberId: member.id, userId: primaryUserId }),
        ),
      );

      return { id: member.id, ...params };
    };
  });

  describe('insert', () => {
    it('should insert a member without optional params + validate all fields', async () => {
      const primaryUser = await modelUser.create(generateCreateUserParams());
      const org = await modelOrg.create(generateOrgParams());

      const createMemberParams = generateCreateMemberParams({
        orgId: org._id,
      });
      createMemberParams.zipCode = undefined;
      const { member } = await service.insert(createMemberParams, primaryUser._id);

      expect(member?.id).not.toBeUndefined();

      const createdMember: any = await memberModel.findById(member.id);
      compareMembers(createdMember, createMemberParams);
    });

    it('should insert a member with all params + validate all insert fields', async () => {
      const primaryUser = await modelUser.create(generateCreateUserParams());
      const org = await modelOrg.create(generateOrgParams());

      const createMemberParams = generateCreateMemberParams({
        orgId: org._id,
        sex: Sex.female,
        email: internet.email(),
        language: Language.es,
        zipCode: generateZipCode(),
        dischargeDate: generateDateOnly(date.future(1)),
        honorific: Honorific.dr,
      });
      const { member } = await service.insert(createMemberParams, primaryUser._id);

      expect(member?.id).not.toBeUndefined();

      const createdMember: any = await memberModel.findById(member.id);
      compareMembers(createdMember, createMemberParams);
    });

    it('should check that createdAt and updatedAt exists in the collection', async () => {
      const id = await generateMember();

      const createdMember: any = await memberModel.findById(id);
      expect(createdMember.createdAt).toEqual(expect.any(Date));
      expect(createdMember.updatedAt).toEqual(expect.any(Date));
    });

    it('should remove not nullable optional params if null is passed', async () => {
      const primaryUser = await modelUser.create(generateCreateUserParams());
      const org = await modelOrg.create(generateOrgParams());

      const createMemberParams = generateCreateMemberParams({ orgId: org._id });

      NotNullableMemberKeys.forEach((key) => {
        createMemberParams[key] = null;
      });

      createMemberParams.firstName = faker.name.firstName();
      createMemberParams.lastName = faker.name.lastName();
      createMemberParams.dateOfBirth = generateDateOnly(faker.date.past());

      const { member } = await service.insert(createMemberParams, primaryUser._id);
      const createdObject = await memberModel.findById(member.id);

      NotNullableMemberKeys.forEach((key) => {
        expect(createdObject).not.toHaveProperty(key, null);
      });
    });

    it('should insert a member even with primaryUser not exists', async () => {
      const createMemberParams: CreateMemberParams = generateCreateMemberParams({
        orgId: generateId(),
      });
      const { member } = await service.insert(createMemberParams, new Types.ObjectId(generateId()));

      expect(member?.id).not.toBeUndefined();
    });

    it('should fail to insert an already existing member', async () => {
      const primaryUserId = generateId();
      const createMemberParams = generateCreateMemberParams({ orgId: generateId() });
      await service.insert(createMemberParams, new Types.ObjectId(primaryUserId));

      await expect(
        service.insert(createMemberParams, new Types.ObjectId(primaryUserId)),
      ).rejects.toThrow(Errors.get(ErrorType.memberPhoneAlreadyExists));
    });
  });

  describe('control member', () => {
    it('should insert control member with mandatory params+validate all fields', async () => {
      const org = await modelOrg.create(generateOrgParams());

      const createMemberParams = generateCreateMemberParams({
        orgId: org._id,
      });
      const { id } = await service.insertControl(createMemberParams);
      const createdMember: any = await controlMemberModel.findById(id);
      compareMembers(createdMember, createMemberParams);
    });

    it('should return null when calling getControl on non existing control member', async () => {
      const controlMember = await controlMemberModel.findById(generateId());
      expect(controlMember).toBeNull();
    });

    it('should fail to insert an already existing member', async () => {
      const createMemberParams = generateCreateMemberParams({ orgId: generateId() });
      await service.insertControl(createMemberParams);

      await expect(service.insertControl(createMemberParams)).rejects.toThrow(
        Errors.get(ErrorType.memberPhoneAlreadyExists),
      );
    });

    it('should remove not nullable optional params if null is passed', async () => {
      const org = await modelOrg.create(generateOrgParams());

      const createMemberParams = generateCreateMemberParams({ orgId: org._id });

      NotNullableMemberKeys.forEach((key) => {
        createMemberParams[key] = null;
      });

      createMemberParams.firstName = faker.name.firstName();
      createMemberParams.lastName = faker.name.lastName();
      createMemberParams.dateOfBirth = generateDateOnly(faker.date.past());

      const { id } = await service.insertControl(createMemberParams);
      const createdObject = await controlMemberModel.findById(id);

      NotNullableMemberKeys.forEach((key) => {
        expect(createdObject).not.toHaveProperty(key, null);
      });
    });
  });

  describe('archive', () => {
    it('should throw an error when trying to archive non existing member', async () => {
      await expect(service.moveMemberToArchive(generateId())).rejects.toThrow(
        Errors.get(ErrorType.memberNotFound),
      );
    });

    /* eslint-disable-next-line max-len */
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
        readmissionRisk: ReadmissionRisk.high,
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

    it('should not add to readmissionRiskHistory if the readmissionRisk is the same', async () => {
      const id = await generateMember();

      const updateMemberParams = generateUpdateMemberParams();
      updateMemberParams.readmissionRisk = ReadmissionRisk.low;

      await service.update({ ...updateMemberParams, id });
      const beforeObject = await memberModel.findById(id);

      expect(beforeObject['readmissionRiskHistory'].length).toEqual(1);

      await service.update({ ...updateMemberParams, id });
      const afterObject = await memberModel.findById(id);

      expect(afterObject['readmissionRiskHistory'].length).toEqual(1);
    });

    it('should add to readmissionRiskHistory if the readmissionRisk is not the same', async () => {
      const id = await generateMember();

      const updateMemberParams = generateUpdateMemberParams();
      updateMemberParams.readmissionRisk = ReadmissionRisk.low;

      await service.update({ ...updateMemberParams, id });
      const beforeObject = await memberModel.findById(id);

      expect(beforeObject['readmissionRiskHistory'].length).toEqual(1);

      updateMemberParams.readmissionRisk = ReadmissionRisk.high;
      await service.update({ ...updateMemberParams, id });
      const afterObject = await memberModel.findById(id);

      expect(afterObject['readmissionRiskHistory'].length).toEqual(2);
    });

    const updateMember = async (updateMemberParams?: Omit<UpdateMemberParams, 'id' | 'authId'>) => {
      const id = await generateMember();

      const beforeObject: any = await memberModel.findById(id);

      await service.update({ id, ...updateMemberParams });
      const afterObject: any = await memberModel.findById(id);

      expect(afterObject.toJSON()).toEqual({
        ...beforeObject.toJSON(),
        ...updateMemberParams,
        readmissionRiskHistory: expect.any(Array),
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

  describe('createJournal', () => {
    it('should create journal', async () => {
      const memberId = generateId();

      const { id } = await service.createJournal(memberId);
      const result: any = await modelJournal.findById(id);

      expect(result).toMatchObject({
        _id: id,
        memberId: new Types.ObjectId(memberId),
        published: false,
      });
    });
  });

  describe('updateJournal', () => {
    it('should update journal', async () => {
      const memberId = generateId();

      const { id } = await service.createJournal(memberId);
      const updateJournalTextParams = generateUpdateJournalTextParams({ id });

      const journal = await service.updateJournal({ ...updateJournalTextParams, memberId });
      const result: any = await modelJournal.findById(id);

      expect(result).toMatchObject(journal);
    });

    it(`should throw an error on update journal if another member`, async () => {
      const { id } = await service.createJournal(generateId());
      await expect(
        service.updateJournal({
          ...generateUpdateJournalTextParams({ id }),
          memberId: generateId(),
        }),
      ).rejects.toThrow(Error(Errors.get(ErrorType.memberJournalNotFound)));
    });

    it(`should throw an error on update journal when id doesn't exists`, async () => {
      await expect(
        service.updateJournal({ ...generateUpdateJournalTextParams(), memberId: generateId() }),
      ).rejects.toThrow(Error(Errors.get(ErrorType.memberJournalNotFound)));
    });
  });

  describe('updateJournalImageFormat', () => {
    it('should update journal imageFormat', async () => {
      const memberId = generateId();

      const { id } = await service.createJournal(memberId);
      const updateJournalImageFormatParams = generateGetMemberUploadJournalImageLinkParams({ id });

      const journal = await service.updateJournal({ ...updateJournalImageFormatParams, memberId });
      const result: any = await modelJournal.findById(id);

      expect(result).toMatchObject(journal);
    });

    it(`should throw an error on update journal image format if another member`, async () => {
      const { id } = await service.createJournal(generateId());
      await expect(
        service.updateJournal({
          id,
          imageFormat: ImageFormat.png,
          memberId: generateId(),
        }),
      ).rejects.toThrow(Error(Errors.get(ErrorType.memberJournalNotFound)));
    });

    it(`should throw an error on update journal image format when id doesn't exists`, async () => {
      await expect(
        service.updateJournal({
          id: generateId(),
          imageFormat: ImageFormat.png,
          memberId: generateId(),
        }),
      ).rejects.toThrow(Error(Errors.get(ErrorType.memberJournalNotFound)));
    });
  });

  describe('getJournal', () => {
    it('should get journal', async () => {
      const memberId = generateId();

      const { id } = await service.createJournal(memberId);
      const updateJournalTextParams = generateUpdateJournalTextParams({ id });

      await service.updateJournal({ ...updateJournalTextParams, memberId });

      const result: any = await modelJournal.findById(id);
      const journal = await service.getJournal(id, memberId);

      expect(result).toMatchObject({
        _id: new Types.ObjectId(journal.id),
        memberId: new Types.ObjectId(journal.memberId),
        published: journal.published,
        text: journal.text,
        updatedAt: journal.updatedAt,
      });
    });

    it(`should throw an error on get journal if another member`, async () => {
      const { id } = await service.createJournal(generateId());
      await expect(service.getJournal(id, generateId())).rejects.toThrow(
        Error(Errors.get(ErrorType.memberJournalNotFound)),
      );
    });

    it(`should throw an error on get journal when id doesn't exists`, async () => {
      await expect(service.getJournal(generateId(), generateId())).rejects.toThrow(
        Error(Errors.get(ErrorType.memberJournalNotFound)),
      );
    });
  });

  describe('getJournals', () => {
    it('should get journals by memberId', async () => {
      const memberId = generateId();

      const { id: journalId1 } = await service.createJournal(memberId);
      const { id: journalId2 } = await service.createJournal(memberId);
      const updateJournalTextParams1 = generateUpdateJournalTextParams({ id: journalId1 });
      const updateJournalTextParams2 = generateUpdateJournalTextParams({ id: journalId2 });

      await service.updateJournal({ ...updateJournalTextParams1, memberId });
      await service.updateJournal({ ...updateJournalTextParams2, memberId });

      const journals = await service.getJournals(memberId);

      expect(journals).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            _id: new Types.ObjectId(journalId1),
            memberId: new Types.ObjectId(memberId),
            published: false,
            text: updateJournalTextParams1.text,
            updatedAt: expect.any(Date),
            createdAt: expect.any(Date),
          }),
          expect.objectContaining({
            _id: new Types.ObjectId(journalId2),
            memberId: new Types.ObjectId(memberId),
            published: false,
            text: updateJournalTextParams2.text,
            updatedAt: expect.any(Date),
            createdAt: expect.any(Date),
          }),
        ]),
      );
    });

    it(`should not get journals by memberId if text doesn't exists`, async () => {
      const memberId = generateId();
      const { id } = await service.createJournal(memberId);

      const journals = await service.getJournals(memberId);

      expect(journals).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            _id: new Types.ObjectId(id),
            memberId: new Types.ObjectId(memberId),
            published: false,
            text: expect.any(String),
            updatedAt: expect.any(Date),
            createdAt: expect.any(Date),
          }),
        ]),
      );
    });

    it(`should return empty array if member doesn't have journals`, async () => {
      const memberId = generateId();
      const journals = await service.getJournals(memberId);

      expect(journals).toEqual([]);
    });
  });

  describe('deleteJournal', () => {
    it('should delete journal', async () => {
      const memberId = generateId();
      const { id } = await service.createJournal(memberId);

      await service.getJournal(id, memberId);
      const journalDelete = await service.deleteJournal(id, memberId);

      expect(journalDelete).toBeTruthy();

      await expect(service.getJournal(id, memberId)).rejects.toThrow(
        Error(Errors.get(ErrorType.memberJournalNotFound)),
      );
    });

    it(`should throw an error on delete journal if another member`, async () => {
      const { id } = await service.createJournal(generateId());
      await expect(service.deleteJournal(id, generateId())).rejects.toThrow(
        Error(Errors.get(ErrorType.memberJournalNotFound)),
      );
    });

    it(`should throw an error on delete journal when id doesn't exists`, async () => {
      await expect(service.deleteJournal(generateId(), generateId())).rejects.toThrow(
        Error(Errors.get(ErrorType.memberJournalNotFound)),
      );
    });
  });

  describe('caregivers', () => {
    let caregiverId;

    describe('addCaregiver and getCaregiver', () => {
      it('should add a caregiver', async () => {
        const caregiverParams = generateAddCaregiverParams();
        const memberId = generateId();
        const { id } = await service.addCaregiver(memberId, caregiverParams);
        caregiverId = id;
        const caregiver: any = await service.getCaregiver(id);

        expect(service.replaceId(caregiver.toObject())).toMatchObject({
          ...caregiverParams,
          memberId: new Types.ObjectId(memberId),
          id: new Types.ObjectId(id),
        });
      });

      it('should update a caregiver', async () => {
        const updateCaregiverParams = generateUpdateCaregiverParams({ id: caregiverId });
        const memberId = generateId();

        const { id } = await service.updateCaregiver(memberId, updateCaregiverParams);

        const caregiver: any = await service.getCaregiver(id);

        expect(service.replaceId(caregiver.toObject())).toMatchObject({
          ...updateCaregiverParams,
          memberId: new Types.ObjectId(memberId),
          id: new Types.ObjectId(id),
        });
      });

      it('should delete a caregiver', async () => {
        const status = await service.deleteCaregiver(caregiverId);

        expect(status).toBeTruthy();

        const caregiver: any = await service.getCaregiver(caregiverId);
        expect(caregiver).toBeFalsy();
      });
    });
  });

  describe('updateMemberConfig', () => {
    it('should update memberConfig multiple times', async () => {
      //1st memberConfig is inserted in generateMember with externalUserId only
      const id = await generateMember();
      const params1 = await generateUpdateMemberConfigParams({
        memberId: generateId(id),
        platform: Platform.android,
        isPushNotificationsEnabled: false,
        isAppointmentsReminderEnabled: false,
        isRecommendationsEnabled: true,
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
        isPushNotificationsEnabled: true,
        isAppointmentsReminderEnabled: true,
        isRecommendationsEnabled: false,
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
      expect(configs[Object.keys(field)[0]]).toEqual(true);
    });

    it('should not update member config on non existing member', async () => {
      await expect(service.updateMemberConfig(generateUpdateMemberConfigParams())).rejects.toThrow(
        Errors.get(ErrorType.memberNotFound),
      );
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

  describe('updatePrimaryUser', () => {
    it('should fail to update on non existing member', async () => {
      const userId = generateId();
      const memberId = generateId();
      await expect(service.updatePrimaryUser({ userId, memberId })).rejects.toThrow(
        Errors.get(ErrorType.memberNotFound),
      );
    });

    it('should throw an error if the new user equals the old user', async () => {
      const memberId = await generateMember();
      const member = await service.get(memberId);

      await expect(
        service.updatePrimaryUser({ userId: member.primaryUserId.toString(), memberId }),
      ).rejects.toThrow(Errors.get(ErrorType.memberReplaceUserAlreadyExists));
    });

    it('should update the primary user and add new user to the users list', async () => {
      const memberId = await generateMember();
      const newUser = await modelUser.create(generateCreateUserParams());
      const oldMember = await service.get(memberId);

      const result = await service.updatePrimaryUser({ userId: newUser._id, memberId });

      const updatedMember = await service.get(memberId);
      expect(updatedMember.primaryUserId).toEqual(newUser._id);
      expect(result.primaryUserId).toEqual(oldMember.primaryUserId);
      compareUsers(updatedMember.users[updatedMember.users.length - 1], newUser);
    });
  });

  const generateMember = async (orgId?: string, userId?: string): Promise<string> => {
    orgId = orgId ? orgId : await generateOrg();
    userId = userId ? userId : await generateUser();
    const createMemberParams = generateCreateMemberParams({ orgId });
    const { member } = await service.insert(createMemberParams, new Types.ObjectId(userId));
    return member.id;
  };

  const generateOrg = async (): Promise<string> => {
    const { _id: ordId } = await modelOrg.create(generateOrgParams());
    return ordId;
  };

  const generateUser = async (): Promise<string> => {
    const { _id: userId } = await modelUser.create(generateCreateUserParams());
    return userId;
  };

  const generateAppointment = async ({
    memberId,
    userId,
    start = faker.date.soon(4),
    status = AppointmentStatus.scheduled,
  }: {
    memberId: string;
    userId: string;
    start?: Date;
    status?: AppointmentStatus;
  }): Promise<AppointmentDocument> => {
    const appointment = await modelAppointment.create({
      ...generateScheduleAppointmentParams({ memberId, userId, start }),
      status,
    });
    await modelUser.updateOne(
      { _id: userId },
      { $push: { appointments: new Types.ObjectId(appointment.id) } },
      { new: true },
    );
    await memberModel.updateOne(
      { _id: Types.ObjectId(memberId) },
      { $addToSet: { users: userId } },
    );
    return appointment as any;
  };
});
