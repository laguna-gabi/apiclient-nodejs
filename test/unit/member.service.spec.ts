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
  generateId,
  generateMemberLinks,
  generateObjectId,
  generateOrgParams,
  generateRequestAppointmentParams,
  generateScheduleAppointmentParams,
  generateUpdateMemberParams,
  generateUpdateTaskStatusParams,
  generateZipCode,
} from '../index';
import {
  CreateMemberParams,
  defaultMemberParams,
  Member,
  MemberDto,
  MemberModule,
  MemberService,
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

describe('MemberService', () => {
  let module: TestingModule;
  let service: MemberService;
  let memberModel: Model<typeof MemberDto>;
  let modelUser: Model<typeof UserDto>;
  let modelOrg: Model<typeof OrgDto>;
  let modelAppointment: Model<typeof AppointmentDto>;
  const primaryCoachId = generateId();

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
          orgId: generateId(),
          primaryCoachId: primaryCoach._id,
          usersIds: [user._id, nurse._id],
        });

        const links = generateMemberLinks(member.firstName, member.lastName);

        const { _id } = await memberModel.create({
          phone: member.phone,
          deviceId,
          firstName: member.firstName,
          lastName: member.lastName,
          org: generateObjectId(org.id),
          primaryCoach: generateObjectId(member.primaryCoachId),
          users: member.usersIds.map((item) => generateObjectId(item)),
          ...links,
        });

        const result = await params.method(params.field === 'context' ? member.deviceId : _id);

        expect(result.id).toEqual(_id.toString());
        expect(result.phone).toEqual(member.phone);
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
      },
    );
  });

  describe('getMembers', () => {
    it('should return empty list for non existing orgId', async () => {
      const result = await service.getByOrg(generateId());
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
      const member = await service.getByDeviceId(deviceId);

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
          primaryCoach: expect.objectContaining({ _id: primaryCoachId }),
          nextAppointment: undefined,
          appointmentsCount: 0,
        }),
      );
    });
  });

  const generateBasicMember = async (createMemberParamsInput?): Promise<Identifier> => {
    const createMemberParams = generateCreateMemberParams(createMemberParamsInput);
    const links = generateMemberLinks(createMemberParams.firstName, createMemberParams.lastName);

    return service.insert({ createMemberParams, ...links });
  };

  describe('getMembersAppointments', () => {
    it('should return empty array on members with orgId and no appointments', async () => {
      const { _id: primaryCoachId } = await modelUser.create(generateCreateUserParams());
      const { _id: orgId } = await modelOrg.create(generateOrgParams());

      await generateBasicMember({ primaryCoachId, orgId });
      await generateBasicMember({ primaryCoachId, orgId });
      await generateBasicMember({ primaryCoachId, orgId });

      const result = await service.getMembersAppointments(orgId);
      expect(result).toEqual([]);
    });

    it('should return members with by orgId and appointments for each', async () => {
      const primaryCoachParams = {
        firstName: faker.name.firstName(),
        lastName: faker.name.lastName(),
      };
      const { _id: primaryCoachId } = await modelUser.create(
        generateCreateUserParams({ ...primaryCoachParams }),
      );
      const { _id: orgId } = await modelOrg.create(generateOrgParams());

      const member1AppointmentsCount = 3;
      const member1 = await generateMemberAndAppointment({
        primaryCoachId,
        orgId,
        numberOfAppointments: member1AppointmentsCount,
      });
      const member2AppointmentsCount = 4;
      const member2 = await generateMemberAndAppointment({
        primaryCoachId,
        orgId,
        numberOfAppointments: member2AppointmentsCount,
      });

      const result = await service.getMembersAppointments(orgId);
      expect(result.length).toEqual(member1AppointmentsCount + member2AppointmentsCount);
      expect(result).toEqual(
        expect.arrayContaining([
          {
            memberId: member1.id,
            userId: primaryCoachId,
            memberName: `${member1.firstName} ${member1.lastName}`,
            userName: `${primaryCoachParams.firstName} ${primaryCoachParams.lastName}`,
            start: expect.any(Date),
            end: expect.any(Date),
          },
          {
            memberId: member2.id,
            userId: primaryCoachId,
            memberName: `${member2.firstName} ${member2.lastName}`,
            userName: `${primaryCoachParams.firstName} ${primaryCoachParams.lastName}`,
            start: expect.any(Date),
            end: expect.any(Date),
          },
        ]),
      );
    });

    it('should exclude non org members from results', async () => {
      const primaryCoachParams = {
        firstName: faker.name.firstName(),
        lastName: faker.name.lastName(),
      };
      const { _id: primaryCoachId } = await modelUser.create(
        generateCreateUserParams({ ...primaryCoachParams }),
      );
      const { _id: orgId1 } = await modelOrg.create(generateOrgParams());
      const { _id: orgId2 } = await modelOrg.create(generateOrgParams());

      const memberAppointmentsCount = 2;
      const member = await generateMemberAndAppointment({
        primaryCoachId,
        orgId: orgId1,
        numberOfAppointments: memberAppointmentsCount,
      });
      await generateMemberAndAppointment({
        primaryCoachId,
        orgId: orgId2,
        numberOfAppointments: 1,
      });

      const result = await service.getMembersAppointments(orgId1);
      expect(result.length).toEqual(memberAppointmentsCount);
      expect(result).toEqual(
        expect.arrayContaining([
          {
            memberId: member.id,
            userId: primaryCoachId,
            memberName: `${member.firstName} ${member.lastName}`,
            userName: `${primaryCoachParams.firstName} ${primaryCoachParams.lastName}`,
            start: expect.any(Date),
            end: expect.any(Date),
          },
        ]),
      );
    });

    it('should sort results by start timestamp desc', async () => {
      const { _id: primaryCoachId } = await modelUser.create(generateCreateUserParams());
      const { _id: orgId } = await modelOrg.create(generateOrgParams());

      const member1AppointmentsCount = 3;
      await generateMemberAndAppointment({
        primaryCoachId,
        orgId,
        numberOfAppointments: member1AppointmentsCount,
      });
      const member2AppointmentsCount = 4;
      await generateMemberAndAppointment({
        primaryCoachId,
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
      const { _id: primaryCoachId } = await modelUser.create(generateCreateUserParams());
      const { _id: orgId } = await modelOrg.create(generateOrgParams());

      const numberOfAppointments = 1;
      const { id } = await generateMemberAndAppointment({
        primaryCoachId,
        orgId,
        numberOfAppointments,
      });

      await modelAppointment.create({
        ...generateRequestAppointmentParams({ memberId: id, userId: primaryCoachId }),
      });

      const result = await service.getMembersAppointments(orgId);
      expect(result.length).toEqual(numberOfAppointments);
      expect(result[0]).toEqual(expect.objectContaining({ memberId: id, userId: primaryCoachId }));
    });

    it('should not take longer than 2 seconds to query with no filter orgId', async () => {
      await service.getMembersAppointments();
    }, 2000);

    const generateMemberAndAppointment = async ({
      primaryCoachId,
      orgId,
      numberOfAppointments,
    }) => {
      const params = { firstName: faker.name.firstName(), lastName: faker.name.lastName() };
      const { id } = await generateBasicMember({ primaryCoachId, orgId, ...params });

      await Promise.all(
        Array.from(Array(numberOfAppointments)).map(
          async () =>
            await modelAppointment.create({
              ...generateScheduleAppointmentParams({ memberId: id, userId: primaryCoachId }),
              status: AppointmentStatus.scheduled,
            }),
        ),
      );

      return { id, ...params };
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
      createMemberParams.zipCode = undefined;
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
        zipCode: generateZipCode(),
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
      expect(createdMember.phone).toEqual(createMemberParams.phone);
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
        orgId: generateId(),
        primaryCoachId,
      });
      const links = generateMemberLinks(createMemberParams.firstName, createMemberParams.lastName);

      const result = await service.insert({ createMemberParams, ...links });

      expect(result.id).not.toBeUndefined();
    });

    it('should fail to insert an already existing member', async () => {
      const createMemberParams = generateCreateMemberParams({
        orgId: generateId(),
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
});
