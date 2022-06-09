import { Appointment, AppointmentStatus, User } from '@argus/hepiusClient';
import { AppointmentInternalKey, ChatInternalKey } from '@argus/irisClient';
import {
  ChangeEventType,
  EntityName,
  Language,
  Platform,
  createChangeEvent,
  generateId,
  generateObjectId,
  generatePhone,
  generateZipCode,
  mockLogger,
  mockProcessWarnings,
} from '@argus/pandora';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { articlesByDrg, queryDaysLimit } from 'config';
import { sub } from 'date-fns';
import { address, datatype, date, internet, name } from 'faker';
import { Model, Types, model } from 'mongoose';
import { performance } from 'perf_hooks';
import {
  checkDelete,
  compareMembers,
  compareUsers,
  dbConnect,
  dbDisconnect,
  defaultModules,
  generateAddInsuranceParams,
  generateCreateMemberParams,
  generateCreateUserParams,
  generateDateOnly,
  generateDeleteMemberParams,
  generateInternalCreateMemberParams,
  generateOrgParams,
  generateReplaceMemberOrgParams,
  generateScheduleAppointmentParams,
  generateUpdateMemberConfigParams,
  generateUpdateMemberParams,
  loadSessionClient,
  mockGenerateDispatch,
  mockGenerateJourney,
} from '..';
import { AppointmentDocument, AppointmentDto, AppointmentModule } from '../../src/appointment';
import {
  AlertType,
  DismissedAlert,
  DismissedAlertDocument,
  DismissedAlertDto,
  ErrorType,
  Errors,
  LoggerService,
  PhoneType,
  defaultTimestampsDbValues,
} from '../../src/common';
import { Journey, JourneyDocument, JourneyDto } from '../../src/journey';
import {
  ControlMember,
  ControlMemberDocument,
  ControlMemberDto,
  Honorific,
  Insurance,
  InsuranceDocument,
  InsuranceDto,
  InternalCreateMemberParams,
  Member,
  MemberConfig,
  MemberConfigDocument,
  MemberConfigDto,
  MemberDocument,
  MemberDto,
  MemberModule,
  MemberService,
  NotNullableMemberKeys,
  Sex,
  UpdateMemberParams,
} from '../../src/member';
import { Org, OrgDocument, OrgDto } from '../../src/org';
import { Internationalization } from '../../src/providers';
import { NotificationService } from '../../src/services';
import { UserDocument, UserDto } from '../../src/user';
import { confirmEmittedChangeEvent } from '../common';

describe('MemberService', () => {
  let module: TestingModule;
  let service: MemberService;
  let memberModel: Model<MemberDocument & defaultTimestampsDbValues>;
  let memberConfigModel: Model<MemberConfigDocument>;
  let controlMemberModel: Model<ControlMemberDocument & defaultTimestampsDbValues>;
  let modelUser: Model<UserDocument>;
  let modelOrg: Model<OrgDocument>;
  let modelAppointment: Model<AppointmentDocument>;
  let modelDismissedAlert: Model<DismissedAlertDocument>;
  let modelJourney: Model<JourneyDocument & defaultTimestampsDbValues>;
  let modelInsurance: Model<InsuranceDocument>;
  let i18nService: Internationalization;

  beforeAll(async () => {
    mockProcessWarnings(); // to hide pino prettyPrint warning
    module = await Test.createTestingModule({
      imports: defaultModules().concat(MemberModule, AppointmentModule),
    }).compile();

    service = module.get<MemberService>(MemberService);
    mockLogger(module.get<LoggerService>(LoggerService));

    i18nService = module.get<Internationalization>(Internationalization);
    await i18nService.onModuleInit();

    memberModel = model<MemberDocument & defaultTimestampsDbValues>(Member.name, MemberDto);

    memberConfigModel = model<MemberConfigDocument>(MemberConfig.name, MemberConfigDto);
    controlMemberModel = model<ControlMemberDocument & defaultTimestampsDbValues>(
      ControlMember.name,
      ControlMemberDto,
    );
    modelUser = model<UserDocument>(User.name, UserDto);
    modelOrg = model<OrgDocument>(Org.name, OrgDto);
    modelAppointment = model<AppointmentDocument>(Appointment.name, AppointmentDto);
    modelDismissedAlert = model<DismissedAlertDocument>(DismissedAlert.name, DismissedAlertDto);
    modelJourney = model<JourneyDocument & defaultTimestampsDbValues>(Journey.name, JourneyDto);
    modelInsurance = model<InsuranceDocument>(Insurance.name, InsuranceDto);

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

      const { memberId: memberId1a } = await generateMember(orgId1);
      const { memberId: memberId1b } = await generateMember(orgId1);

      await generateMember(orgId2);

      const result = await service.getByOrg(orgId1);
      expect(result.length).toEqual(2);
      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: new Types.ObjectId(memberId1a) }),
          expect.objectContaining({ id: new Types.ObjectId(memberId1b) }),
        ]),
      );
    });

    it('should return all members on missing orgId input', async () => {
      const orgId1 = await generateOrg();
      const orgId2 = await generateOrg();

      const { memberId: memberId1a } = await generateMember(orgId1);
      const { memberId: memberId1b } = await generateMember(orgId1);
      const { memberId: memberId2 } = await generateMember(orgId2);

      const result = await service.getByOrg();
      expect(result.length).toBeGreaterThan(3);
      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: new Types.ObjectId(memberId1a) }),
          expect.objectContaining({ id: new Types.ObjectId(memberId1b) }),
          expect.objectContaining({ id: new Types.ObjectId(memberId2) }),
        ]),
      );
    }, 10000);

    it('should handle member with default values', async () => {
      const primaryUserId = await generateUser();
      const orgId = await generateOrg();

      const { memberId } = await generateMember(orgId, primaryUserId);
      const result = await service.getByOrg(orgId);
      const member = await service.get(memberId);
      const memberConfig = await service.getMemberConfig(memberId);
      const primaryUser = await modelUser.findOne({ _id: primaryUserId });

      expect(result.length).toEqual(1);
      expect(result[0]).toEqual(
        expect.objectContaining({
          id: new Types.ObjectId(memberId),
          name: `${member.firstName} ${member.lastName}`,
          phone: member.phone,
          phoneType: 'mobile',
          dischargeDate: null,
          adherence: 0,
          wellbeing: 0,
          createdAt: member.createdAt,
          actionItemsCount: 0,
          primaryUser: expect.any(Object),
          nextAppointment: undefined,
          appointmentsCount: 0,
          platform: memberConfig.platform,
          isGraduated: false,
        }),
      );
      expect(primaryUser['title']).toEqual(result[0].primaryUser.title);
      expect(primaryUser._id).toEqual(result[0].primaryUser['_id']);
    }, 8000);

    it('should handle member with all values', async () => {
      const primaryUserId = await generateUser();
      const orgId = await generateOrg();
      const phoneType: PhoneType = 'landline';

      const dischargeDate = generateDateOnly(date.future(1));
      const { member: createdMember } = await service.insert(
        { ...generateCreateMemberParams({ orgId, dischargeDate }), phoneType },
        new Types.ObjectId(primaryUserId),
      );
      const memberId = createdMember.id;
      await modelJourney.create(mockGenerateJourney({ memberId }));

      const result = await service.getByOrg(orgId);
      const member = await service.get(memberId);
      const memberConfig = await service.getMemberConfig(memberId);
      const primaryUser = await modelUser.findById(primaryUserId);

      expect(result.length).toEqual(1);
      expect(result[0]).toEqual(
        expect.objectContaining({
          id: new Types.ObjectId(memberId),
          name: `${member.firstName} ${member.lastName}`,
          phone: member.phone,
          phoneType,
          dischargeDate: member.dischargeDate,
          adherence: 0,
          wellbeing: 0,
          createdAt: member.createdAt,
          actionItemsCount: 0,
          primaryUser: expect.any(Object),
          nextAppointment: undefined,
          appointmentsCount: 0,
          platform: memberConfig.platform,
          isGraduated: false,
        }),
      );

      expect(primaryUser['title']).toEqual(result[0].primaryUser.title);
      expect(primaryUser._id).toEqual(result[0].primaryUser['_id']);
    }, 10000);

    it('should return no nextAppointment on no scheduled appointments', async () => {
      const userId = await generateUser();
      const orgId = await generateOrg();
      const { memberId, journeyId } = await generateMember(orgId);
      await generateAppointment({ memberId, userId, journeyId, status: AppointmentStatus.done });

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
      const { memberId, journeyId } = await generateMember(orgId);

      // first appointment
      const start1 = new Date();
      start1.setHours(start1.getHours() + 2);
      const appointment1 = await generateAppointment({
        memberId,
        userId,
        journeyId,
        start: start1,
      });

      // second appointment
      const start2 = new Date();
      start2.setHours(start1.getHours() + secondAppointmentGap);
      const appointment2 = await generateAppointment({
        memberId,
        userId,
        journeyId,
        start: start2,
      });

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

      const { memberId, journeyId } = await generateMember(orgId);

      let startPrimaryUser = new Date();
      startPrimaryUser.setHours(startPrimaryUser.getHours() + 10);
      await generateAppointment({ userId: userId1, memberId, journeyId, start: startPrimaryUser });
      startPrimaryUser = new Date();
      startPrimaryUser.setHours(startPrimaryUser.getHours() + 6);
      await generateAppointment({ userId: userId2, memberId, journeyId, start: startPrimaryUser });

      const startUser1 = new Date();
      startUser1.setHours(startUser1.getHours() + 4);
      const appointment = await generateAppointment({
        userId: userId1,
        memberId,
        journeyId,
        start: startUser1,
      });

      const startUser2 = new Date();
      startUser2.setHours(startUser2.getHours() + 8);
      await generateAppointment({ userId: userId2, memberId, journeyId, start: startUser2 });

      // insert a deleted appointment - should not be counted
      const startUser3 = new Date();
      startUser3.setHours(startUser3.getHours() + 12);
      const deletedAppointment = await generateAppointment({
        userId: userId2,
        memberId,
        journeyId,
        start: startUser3,
      });
      await deletedAppointment.delete(new Types.ObjectId(userId2));

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
      const { memberId, journeyId } = await generateMember(orgId);

      const start = new Date();
      start.setHours(start.getHours() + 4);
      const appointment = await generateAppointment({ userId, memberId, journeyId, start });

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
        const { memberId, journeyId } = await generateMember(orgId);
        await generateAppointment({ memberId, userId, journeyId });
        await generateAppointment({ memberId, userId, journeyId });
        await generateAppointment({ memberId, userId, journeyId });
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
        firstName: name.firstName(),
        lastName: name.lastName(),
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
            memberId: new Types.ObjectId(member1.id),
            userId: primaryUserId,
            memberName: `${member1.firstName} ${member1.lastName}`,
            userName: `${primaryUserParams.firstName} ${primaryUserParams.lastName}`,
            start: expect.any(Date),
            end: expect.any(Date),
            status: AppointmentStatus.scheduled,
          },
          {
            memberId: new Types.ObjectId(member2.id),
            userId: primaryUserId,
            memberName: `${member2.firstName} ${member2.lastName}`,
            userName: `${primaryUserParams.firstName} ${primaryUserParams.lastName}`,
            start: expect.any(Date),
            end: expect.any(Date),
            status: AppointmentStatus.scheduled,
          },
        ]),
      );
    });

    it('should exclude non org members from results', async () => {
      const primaryUserParams = {
        firstName: name.firstName(),
        lastName: name.lastName(),
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

      const result = await service.getMembersAppointments(orgId1.toString());
      expect(result.length).toEqual(memberAppointmentsCount);
      expect(result).toEqual(
        expect.arrayContaining([
          {
            memberId: new Types.ObjectId(member.id),
            userId: primaryUserId,
            memberName: `${member.firstName} ${member.lastName}`,
            userName: `${primaryUserParams.firstName} ${primaryUserParams.lastName}`,
            start: expect.any(Date),
            end: expect.any(Date),
            status: AppointmentStatus.scheduled,
          },
        ]),
      );
    });

    it('should sort results by start timestamp desc', async () => {
      const { _id: primaryUserId } = await modelUser.create(
        generateCreateUserParams({
          firstName: name.firstName(),
          lastName: name.lastName(),
        }),
      );
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

    // eslint-disable-next-line max-len
    it(`should not include appointments older that ${queryDaysLimit.getMembersAppointments} days ago`, async () => {
      const orgId = await generateOrg();
      const { memberId, journeyId } = await generateMember(orgId);
      const member = await service.get(memberId);

      const startDate1 = new Date();
      startDate1.setDate(startDate1.getDate() - (queryDaysLimit.getMembersAppointments + 1));
      // create a `scheduled` appointment for the member (and primary user)
      await generateAppointment({
        memberId,
        journeyId,
        userId: member.primaryUserId.toString(),
        status: AppointmentStatus.scheduled,
        start: startDate1,
      });

      const startDate2 = new Date();
      startDate2.setDate(startDate2.getDate() - (queryDaysLimit.getMembersAppointments - 1));
      await generateAppointment({
        memberId,
        journeyId,
        userId: member.primaryUserId.toString(),
        status: AppointmentStatus.scheduled,
        start: startDate2,
      });

      const result = await service.getMembersAppointments(orgId);
      expect(result.length).toEqual(1);
      expect(result[0]).toEqual(
        expect.objectContaining({
          memberId: new Types.ObjectId(memberId),
          userId: member.primaryUserId,
          start: startDate2,
        }),
      );
    });

    const generateMemberAndAppointment = async ({ primaryUserId, orgId, numberOfAppointments }) => {
      const params = { firstName: name.firstName(), lastName: name.lastName() };
      const { member } = await service.insert(
        generateInternalCreateMemberParams({ orgId, ...params }),
        primaryUserId,
      );
      const memberId = member.id;
      const { id: journeyId } = await modelJourney.create(mockGenerateJourney({ memberId }));

      await Promise.all(
        Array.from(Array(numberOfAppointments)).map(async () =>
          generateAppointment({ memberId, userId: primaryUserId, journeyId }),
        ),
      );

      return { id: member.id, ...params };
    };
  });

  describe('insert', () => {
    it('should insert a member without optional params + validate all fields', async () => {
      const primaryUser = await modelUser.create(generateCreateUserParams());
      const org = await modelOrg.create(generateOrgParams());

      const createMemberParams = generateInternalCreateMemberParams({ orgId: org._id.toString() });
      createMemberParams.zipCode = undefined;
      const { member } = await service.insert(createMemberParams, primaryUser._id);

      expect(member?.id).not.toBeUndefined();

      const createdMember = await memberModel.findById(member.id);
      compareMembers(createdMember, createMemberParams);
    });

    it('should insert a member with all params + validate all insert fields', async () => {
      const primaryUser = await modelUser.create(generateCreateUserParams());
      const org = await modelOrg.create(generateOrgParams());

      const createMemberParams = generateInternalCreateMemberParams({
        orgId: org._id.toString(),
        sex: Sex.female,
        email: internet.email(),
        language: Language.es,
        zipCode: generateZipCode(),
        dischargeDate: generateDateOnly(date.future(1)),
        honorific: Honorific.dr,
      });
      const { member } = await service.insert(createMemberParams, primaryUser._id);

      expect(member?.id).not.toBeUndefined();

      const createdMember = await memberModel.findById(member.id);
      compareMembers(createdMember, createMemberParams);
    });

    it('should check that createdAt and updatedAt exists in the collection', async () => {
      const { memberId: id } = await generateMember();

      const createdMember = await memberModel.findById(id);
      expect(createdMember.createdAt).toEqual(expect.any(Date));
      expect(createdMember.updatedAt).toEqual(expect.any(Date));
    });

    it('should remove not nullable optional params if null is passed', async () => {
      const primaryUser = await modelUser.create(generateCreateUserParams());
      const org = await modelOrg.create(generateOrgParams());

      const createMemberParams = generateInternalCreateMemberParams({ orgId: org._id.toString() });

      NotNullableMemberKeys.forEach((key) => {
        createMemberParams[key] = null;
      });

      createMemberParams.firstName = name.firstName();
      createMemberParams.lastName = name.lastName();
      createMemberParams.dateOfBirth = generateDateOnly(date.past());

      const { member } = await service.insert(createMemberParams, primaryUser._id);
      const createdObject = await memberModel.findById(member.id);

      NotNullableMemberKeys.forEach((key) => {
        expect(createdObject).not.toHaveProperty(key, null);
      });
    });

    it('should insert a member even with primaryUser not exists', async () => {
      const params: InternalCreateMemberParams = generateInternalCreateMemberParams({
        orgId: generateId(),
      });
      const { member } = await service.insert(params, new Types.ObjectId(generateId()));

      expect(member?.id).not.toBeUndefined();
    });

    it('should fail to insert an already existing member', async () => {
      const primaryUserId = generateId();
      const createMemberParams = generateInternalCreateMemberParams({ orgId: generateId() });
      await service.insert(createMemberParams, new Types.ObjectId(primaryUserId));

      await expect(
        service.insert(createMemberParams, new Types.ObjectId(primaryUserId)),
      ).rejects.toThrow(Errors.get(ErrorType.memberPhoneAlreadyExists));
    });
  });

  describe('control member', () => {
    it('should insert control member with mandatory params+validate all fields', async () => {
      const orgParams = generateOrgParams();
      const org = await modelOrg.create(orgParams);

      const createMemberParams = generateInternalCreateMemberParams({ orgId: org._id.toString() });
      const member = await service.insertControl(createMemberParams);
      const createdMember = await controlMemberModel.findById(member.id);
      compareMembers(createdMember, createMemberParams);
      expect(member.org).toEqual(expect.objectContaining(orgParams));
    });

    it('should fail to insert an already existing member', async () => {
      const params = generateInternalCreateMemberParams({ orgId: generateId() });
      await service.insertControl(params);

      await expect(service.insertControl(params)).rejects.toThrow(
        Errors.get(ErrorType.memberPhoneAlreadyExists),
      );
    });

    it('should remove not nullable optional params if null is passed', async () => {
      const org = await modelOrg.create(generateOrgParams());

      const createMemberParams = generateInternalCreateMemberParams({ orgId: org._id.toString() });

      NotNullableMemberKeys.forEach((key) => {
        createMemberParams[key] = null;
      });

      createMemberParams.firstName = name.firstName();
      createMemberParams.lastName = name.lastName();
      createMemberParams.dateOfBirth = generateDateOnly(date.past());

      const { id } = await service.insertControl(createMemberParams);
      const createdObject = await controlMemberModel.findById(id);

      NotNullableMemberKeys.forEach((key) => {
        expect(createdObject).not.toHaveProperty(key, null);
      });
    });

    it('should return true on isControlByPhone by phone when control member exists', async () => {
      const org = await modelOrg.create(generateOrgParams());
      const createMemberParams = generateInternalCreateMemberParams({ orgId: org._id.toString() });
      await service.insertControl(createMemberParams);

      const result = await service.isControlByPhone(createMemberParams.phone);
      expect(result).toBeTruthy();
    });

    it('should return false on isControlByPhone when control member does not exists', async () => {
      const result = await service.isControlByPhone(generatePhone());
      expect(result).toBeFalsy();
    });
  });

  describe('delete', () => {
    it('should throw an error when trying to delete non existing member', async () => {
      await expect(
        service.deleteMember(generateDeleteMemberParams(), generateId()),
      ).rejects.toThrow(Errors.get(ErrorType.memberNotFound));
    });

    it('should return member and member config when deleting a member', async () => {
      const { memberId } = await generateMember();
      const userId = generateId();
      const member = await service.get(memberId);
      const memberConfig = await service.getMemberConfig(memberId);

      const deleteMemberParams = generateDeleteMemberParams({ id: memberId, hard: false });
      const result = await service.deleteMember(deleteMemberParams, userId);
      expect(result.member).toEqual(
        expect.objectContaining({
          id: member.id,
          authId: member.authId,
          firstName: member.firstName,
          primaryUserId: member.primaryUserId,
        }),
      );
      expect(result.memberConfig).toEqual(
        expect.objectContaining({
          memberId: memberConfig.memberId,
          language: memberConfig.language,
          platform: memberConfig.platform,
          externalUserId: memberConfig.externalUserId,
        }),
      );
    });

    test.each([true, false])('should delete member and member config', async (hard) => {
      const { memberId } = await generateMember();
      const userId = generateId();

      const result = await service.deleteMember(
        generateDeleteMemberParams({ id: memberId, hard }),
        userId,
      );
      expect(result).toBeTruthy();

      /* eslint-disable @typescript-eslint/ban-ts-comment */
      // @ts-ignore
      const memberDeletedResult = await memberModel.findWithDeleted({
        _id: new Types.ObjectId(memberId),
      });
      // @ts-ignore
      const memberConfigDeletedResult = await memberConfigModel.findWithDeleted({
        memberId: new Types.ObjectId(memberId),
      });
      /* eslint-enable @typescript-eslint/ban-ts-comment */

      if (hard) {
        [memberDeletedResult, memberConfigDeletedResult].forEach((result) => {
          expect(result).toEqual([]);
        });
      } else {
        await checkDelete(memberDeletedResult, { _id: new Types.ObjectId(memberId) }, userId);
        await checkDelete(
          memberConfigDeletedResult,
          { memberId: new Types.ObjectId(memberId) },
          userId,
        );
      }
    });

    test.each([true, false])(
      'should not get deleted members on get member and getMemberConfig ',
      async (hard) => {
        const { memberId } = await generateMember();
        const userId = generateId();
        const deleteMemberParams = generateDeleteMemberParams({ id: memberId, hard });
        await service.deleteMember(deleteMemberParams, userId);
        await expect(service.get(memberId)).rejects.toThrow(Errors.get(ErrorType.memberNotFound));
        await expect(service.getMemberConfig(memberId)).rejects.toThrow(
          Errors.get(ErrorType.memberNotFound),
        );
      },
    );

    it('should be able to hard delete after soft delete', async () => {
      const { memberId } = await generateMember();
      const userId = generateId();

      const result = await service.deleteMember(
        generateDeleteMemberParams({ id: memberId, hard: false }),
        userId,
      );
      expect(result).toBeTruthy();

      /* eslint-disable @typescript-eslint/ban-ts-comment */
      // @ts-ignore
      const memberDeletedResult = await memberModel.findWithDeleted({
        _id: new Types.ObjectId(memberId),
      });
      // @ts-ignore
      const memberConfigDeletedResult = await memberConfigModel.findWithDeleted({
        memberId: new Types.ObjectId(memberId),
      });
      /* eslint-enable @typescript-eslint/ban-ts-comment */

      await checkDelete(memberDeletedResult, { _id: new Types.ObjectId(memberId) }, userId);
      await checkDelete(
        memberConfigDeletedResult,
        { memberId: new Types.ObjectId(memberId) },
        userId,
      );

      const resultHard = await service.deleteMember(
        generateDeleteMemberParams({ id: memberId, hard: true }),
        userId,
      );
      expect(resultHard).toBeTruthy();
    });
  });

  describe('update', () => {
    it('should throw when trying to update non existing member', async () => {
      await expect(service.update({ id: generateId() })).rejects.toThrow(
        Errors.get(ErrorType.memberNotFound),
      );
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
      const { memberId } = await generateMember();
      const beforeObject = await memberModel.findById(memberId);

      const updateMemberParams = generateUpdateMemberParams();
      NotNullableMemberKeys.forEach((key) => {
        updateMemberParams[key] = null;
      });

      await service.update({ ...updateMemberParams, id: memberId });
      const afterObject = await memberModel.findById(memberId);

      NotNullableMemberKeys.forEach((key) => {
        expect(beforeObject[key]).toEqual(afterObject[key]);
      });
    });

    const updateMember = async (updateMemberParams?: Omit<UpdateMemberParams, 'id' | 'authId'>) => {
      const { memberId: id } = await generateMember();

      const beforeObject = await memberModel.findById(id);

      await service.update({ id, ...updateMemberParams });
      const afterObject = await memberModel.findById(id);

      expect(afterObject.toJSON()).toEqual({
        ...beforeObject.toJSON(),
        ...updateMemberParams,
        updatedAt: afterObject['updatedAt'],
      });
    };

    // eslint-disable-next-line max-len
    it('should not change address.state and address.street when address.city changes', async () => {
      const { memberId: id } = await generateMember();

      // member is created with an empty address so we update to initial address value:
      const beforeObject = await service.update({ ...generateUpdateMemberParams(), id });

      const city = address.city();

      const afterObject = await service.update({
        ...generateUpdateMemberParams({
          address: { city },
        }),
        id,
      });

      expect(afterObject.address).toEqual({ ...beforeObject.address, city });
    });
  });

  describe('dismissAlert and getUserDismissedAlerts', () => {
    it('should dismiss alert for user', async () => {
      const userId = generateId();
      const alertId = generateId();
      await service.dismissAlert(userId, alertId);
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const userDismissedAlerts = await service.getUserDismissedAlerts(userId);
      expect(userDismissedAlerts.length).toBe(1);
      expect(userDismissedAlerts[0]).toEqual(
        expect.objectContaining({
          alertId,
          userId,
        }),
      );
    });
  });

  describe('getAlerts', () => {
    let mockNotificationGetDispatchesByClientSenderId: jest.SpyInstance;

    beforeAll(() => {
      mockNotificationGetDispatchesByClientSenderId = jest.spyOn(
        module.get<NotificationService>(NotificationService),
        `getDispatchesByClientSenderId`,
      );
    });

    afterEach(() => {
      mockNotificationGetDispatchesByClientSenderId.mockReset();
    });

    describe('notification based alerts', () => {
      let orgId, userId, member1, member2, dispatchM1, dispatchM2;
      let now: Date;

      beforeAll(async () => {
        now = new Date();

        // generate a single user with multiple assigned members
        orgId = await generateOrg();
        userId = await generateUser();

        const { memberId: memberId1 } = await generateMember(orgId, userId);
        member1 = await memberModel.findOne({
          _id: new Types.ObjectId(memberId1),
        });

        const { memberId: memberId2 } = await generateMember(orgId, userId);
        member2 = await memberModel.findOne({
          _id: new Types.ObjectId(memberId2),
        });

        dispatchM1 = mockGenerateDispatch({
          senderClientId: member1.id,
          contentKey: AppointmentInternalKey.appointmentScheduledUser,
          sentAt: sub(now, { days: 10 }),
        });
        dispatchM2 = mockGenerateDispatch({
          senderClientId: member2.id,
          contentKey: ChatInternalKey.newChatMessageFromMember,
          sentAt: sub(now, { days: 20 }),
        });
      });

      beforeEach(() => {
        // Mock data from `Iris`
        mockNotificationGetDispatchesByClientSenderId.mockResolvedValueOnce([dispatchM1]);
        mockNotificationGetDispatchesByClientSenderId.mockResolvedValueOnce([dispatchM2]);

        // reset the date which will affect the `isNew` flag
        modelUser.updateOne({ _id: new Types.ObjectId(userId) }, { $unset: { lastQueryAlert: 1 } });
        // delete dismissed alerts which will affect the `dismissed` flag
        modelDismissedAlert.deleteMany({ userId: new Types.ObjectId(userId) });
      });

      afterEach(() => {
        mockNotificationGetDispatchesByClientSenderId.mockReset();
      });

      it('should return an empty list of alerts for a user without members', async () => {
        // generate a single user with multiple assigned members
        const userId = await generateUser();
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        const { lastQueryAlert } = await modelUser.findOne(
          { _id: new Types.ObjectId(userId) },
          { lean: true },
        );
        expect(await service.getAlerts(userId, [], lastQueryAlert)).toEqual([]);
      });

      it('should get alerts', async () => {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        const { lastQueryAlert } = await modelUser.findOne(
          { _id: new Types.ObjectId(userId) },
          { lean: true },
        );
        expect(await service.getAlerts(userId, [member1, member2], lastQueryAlert)).toEqual([
          {
            date: member2.createdAt,
            dismissed: false,
            id: `${member2.id}_${AlertType.memberAssigned}`,
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            text: service.internationalization.getAlerts(AlertType.memberAssigned, {
              member: member2,
            }),
            isNew: true,
            memberId: member2.id.toString(),
            type: AlertType.memberAssigned,
          },
          {
            date: member1.createdAt,
            dismissed: false,
            id: `${member1.id}_${AlertType.memberAssigned}`,
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            text: service.internationalization.getAlerts(AlertType.memberAssigned, {
              member: member1,
            }),
            isNew: true,
            memberId: member1.id.toString(),
            type: AlertType.memberAssigned,
          },
          {
            date: dispatchM1.sentAt,
            dismissed: false,
            id: dispatchM1.dispatchId,
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            text: service.internationalization.getAlerts(AlertType.appointmentScheduledUser, {
              member: member1,
            }),
            isNew: true,
            memberId: member1.id.toString(),
            type: AlertType.appointmentScheduledUser,
          },
          {
            date: dispatchM2.sentAt,
            dismissed: false,
            id: dispatchM2.dispatchId,
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            text: service.internationalization.getAlerts(AlertType.newChatMessageFromMember, {
              member: member2,
            }),
            isNew: true,
            memberId: member2.id.toString(),
            type: AlertType.newChatMessageFromMember,
          },
        ]);
      });

      // eslint-disable-next-line max-len
      it('should get alerts - some with dismissed flag indication and some are not new', async () => {
        await service.dismissAlert(userId, dispatchM1.dispatchId);
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        const { lastQueryAlert } = await modelUser.findOneAndUpdate(
          { _id: new Types.ObjectId(userId) },
          { $set: { lastQueryAlert: sub(now, { days: 15 }) } },
          { lean: true, new: true },
        );

        expect(await service.getAlerts(userId, [member1, member2], lastQueryAlert)).toEqual([
          {
            date: member2.createdAt,
            dismissed: false,
            id: `${member2.id}_${AlertType.memberAssigned}`,
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            text: service.internationalization.getAlerts(AlertType.memberAssigned, {
              member: member2,
            }),
            isNew: true,
            memberId: member2.id.toString(),
            type: AlertType.memberAssigned,
          },
          {
            date: member1.createdAt,
            dismissed: false,
            id: `${member1.id}_${AlertType.memberAssigned}`,
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            text: service.internationalization.getAlerts(AlertType.memberAssigned, {
              member: member1,
            }),
            isNew: true,
            memberId: member1.id.toString(),
            type: AlertType.memberAssigned,
          },
          {
            date: dispatchM1.sentAt,
            dismissed: true,
            id: dispatchM1.dispatchId,
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            text: service.internationalization.getAlerts(AlertType.appointmentScheduledUser, {
              member: member1,
            }),
            isNew: true,
            memberId: member1.id.toString(),
            type: AlertType.appointmentScheduledUser,
          },
          {
            date: dispatchM2.sentAt,
            dismissed: false,
            id: dispatchM2.dispatchId,
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            text: service.internationalization.getAlerts(AlertType.newChatMessageFromMember, {
              member: member2,
            }),
            isNew: false,
            memberId: member2.id.toString(),
            type: AlertType.newChatMessageFromMember,
          },
        ]);
      });
    });
  });

  describe('updateMemberConfig', () => {
    it('should update memberConfig multiple times', async () => {
      //1st memberConfig is inserted in generateMember with externalUserId only
      const { memberId: id } = await generateMember();
      const params1 = await generateUpdateMemberConfigParams({
        memberId: generateId(id),
        platform: Platform.android,
        isPushNotificationsEnabled: false,
        isAppointmentsReminderEnabled: false,
        isRecommendationsEnabled: true,
        isTodoNotificationsEnabled: true,
        language: Language.en,
      });

      await service.updateMemberConfig(params1);

      const configs1 = await service.getMemberConfig(id);
      expect(configs1).toMatchObject({
        ...params1,
        memberId: new Types.ObjectId(params1.memberId),
      });

      const params2 = await generateUpdateMemberConfigParams({
        memberId: generateId(id),
        platform: Platform.web,
        isPushNotificationsEnabled: true,
        isAppointmentsReminderEnabled: true,
        isRecommendationsEnabled: false,
        isTodoNotificationsEnabled: false,
        language: Language.es,
      });
      params2.memberId = id;
      await service.updateMemberConfig(params2);

      const configs2 = await service.getMemberConfig(id);
      expect(configs2).toMatchObject({
        ...params2,
        memberId: new Types.ObjectId(params2.memberId),
      });
    });

    it('should update only isPushNotificationsEnabled', async () => {
      //1st memberConfig is inserted in generateMember with externalUserId only
      const { memberId: id } = await generateMember();

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
      { isTodoNotificationsEnabled: null },
      { language: null },
      { systemVersion: null },
      { brand: null },
      { codePushVersion: null },
      { appVersion: null },
      { buildVersion: null },
    ])('should not override %p since it is not define in input', async (field) => {
      const { memberId: id } = await generateMember();
      const configsBefore = await service.getMemberConfig(id);
      let params = generateUpdateMemberConfigParams({ memberId: generateId(id) });
      params = { ...params, ...field };
      await service.updateMemberConfig(params);

      const configsAfter = await service.getMemberConfig(id);
      expect(configsAfter[Object.keys(field)[0]]).toEqual(configsBefore[Object.keys(field)[0]]);
    });

    it('should not update member config on non existing member', async () => {
      await expect(service.updateMemberConfig(generateUpdateMemberConfigParams())).rejects.toThrow(
        Errors.get(ErrorType.memberNotFound),
      );
    });
  });

  describe('getMemberConfig', () => {
    it('should create memberConfig on memberCreate', async () => {
      const { memberId: id } = await generateMember();
      const CreatedConfigMember = await service.getMemberConfig(id);

      expect(id).toEqual(CreatedConfigMember.memberId.toString());
    });

    it('should fail to fetch member config on non existing member', async () => {
      await expect(service.getMemberConfig(generateId())).rejects.toThrow(
        Errors.get(ErrorType.memberNotFound),
      );
    });

    it('should insert member config on member insert, and fetch it', async () => {
      const { memberId: id } = await generateMember();
      const memberConfig = await service.getMemberConfig(id);

      expect(memberConfig).toEqual(
        expect.objectContaining({
          memberId: new Types.ObjectId(id),
          externalUserId: expect.any(String),
          platform: Platform.web,
        }),
      );
    });
  });

  describe('getArticlesPath', () => {
    it('should return the default path for a non existing drg', async () => {
      const { memberId: id } = await generateMember();
      const memberConfig = await service.getMemberConfig(id);

      expect(memberConfig.articlesPath).toEqual(articlesByDrg.default);
    });

    it('should return the configured path for a configured drg', async () => {
      const { memberId: id } = await generateMember();
      const updateMemberParams = generateUpdateMemberParams({ id, drg: '123' });
      await service.update({ id, ...updateMemberParams });

      const memberConfig = await service.getMemberConfig(id);

      expect(memberConfig.articlesPath).toEqual(articlesByDrg['123']);
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
      const { memberId } = await generateMember();
      const member = await service.get(memberId);

      await expect(
        service.updatePrimaryUser({ userId: member.primaryUserId.toString(), memberId }),
      ).rejects.toThrow(Errors.get(ErrorType.memberReplaceUserAlreadyExists));
    });

    it('should update the primary user and add new user to the users list', async () => {
      const { memberId } = await generateMember();
      const newUser = await modelUser.create(generateCreateUserParams());
      const oldMember = await service.get(memberId);

      const result = await service.updatePrimaryUser({ userId: newUser._id.toString(), memberId });

      const updatedMember = await service.get(memberId);
      expect(updatedMember.primaryUserId).toEqual(newUser._id);
      expect(result.primaryUserId).toEqual(oldMember.primaryUserId);
      compareUsers(updatedMember.users[updatedMember.users.length - 1], newUser);
    });
  });

  describe('replaceMemberOrg', () => {
    it('should update member org', async () => {
      const orgId = await generateOrg();
      const { memberId } = await generateMember(orgId);
      const member = await service.get(memberId);

      /* eslint-disable @typescript-eslint/ban-ts-comment */
      // @ts-ignore
      expect(member.org._id.toString()).toEqual(orgId);

      const NewOrgId = await generateOrg();
      const updatedMember = await service.replaceMemberOrg({ memberId, orgId: NewOrgId });

      /* eslint-disable @typescript-eslint/ban-ts-comment */
      // @ts-ignore
      expect(updatedMember.org._id.toString()).toEqual(NewOrgId);
    });

    it('should fail to replace member org if member does not exist', async () => {
      await expect(service.replaceMemberOrg(generateReplaceMemberOrgParams())).rejects.toThrow(
        Errors.get(ErrorType.memberNotFound),
      );
    });
  });

  describe('insurance', () => {
    let mockEventEmitterEmit: jest.SpyInstance;

    beforeAll(() => {
      mockEventEmitterEmit = jest.spyOn(module.get<EventEmitter2>(EventEmitter2), `emit`);
    });

    afterEach(() => {
      mockEventEmitterEmit.mockReset();
    });

    it('should add insurance plan', async () => {
      const memberId = generateId();

      // start a session and set member id as client in store
      loadSessionClient(memberId);

      const addInsuranceParams = generateAddInsuranceParams({ memberId });
      const { id: insurancePlanId } = await service.addInsurance(addInsuranceParams);

      confirmEmittedChangeEvent(
        mockEventEmitterEmit,
        createChangeEvent({
          action: ChangeEventType.updated,
          entity: EntityName.insurance,
          memberId,
        }),
      );

      const insurancePlans = await service.getInsurance(memberId);

      expect(insurancePlans).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            ...addInsuranceParams,
            memberId: new Types.ObjectId(memberId),
            _id: new Types.ObjectId(insurancePlanId),
          }),
        ]),
      );
    });

    it('should (hard) delete a soft deleted insurance plan', async () => {
      const memberId = generateId();
      const insuranceParams = generateAddInsuranceParams({ memberId });
      const { id } = await service.addInsurance(insuranceParams);

      // soft delete
      await service.deleteInsurance(id, memberId.toString());

      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      let deletedInsurance = await modelInsurance.findOneWithDeleted({
        _id: new Types.ObjectId(id),
      });

      expect(deletedInsurance).toEqual(
        expect.objectContaining({
          ...insuranceParams,
          memberId: new Types.ObjectId(memberId),
        }),
      );

      await service.deleteInsurance(id, memberId.toString(), true);

      confirmEmittedChangeEvent(
        mockEventEmitterEmit,
        createChangeEvent({
          action: ChangeEventType.deleted,
          entity: EntityName.insurance,
          memberId,
        }),
      );

      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      deletedInsurance = await modelInsurance.findOneWithDeleted({
        _id: new Types.ObjectId(id),
      });

      expect(deletedInsurance).toBeFalsy();
    });
  });

  const generateMember = async (
    orgId?: string,
    userId?: string,
  ): Promise<{ memberId: string; journeyId: string }> => {
    orgId = orgId ? orgId : await generateOrg();
    userId = userId ? userId : await generateUser();
    const createMemberParams = generateCreateMemberParams({ orgId });
    const { member } = await service.insert(
      { ...createMemberParams, phoneType: 'mobile' },
      new Types.ObjectId(userId),
    );
    const memberId = member.id;
    const { id: journeyId } = await modelJourney.create(mockGenerateJourney({ memberId }));

    return { memberId, journeyId };
  };

  const generateOrg = async (): Promise<string> => {
    const { _id: ordId } = await modelOrg.create(generateOrgParams());
    return ordId.toString();
  };

  const generateUser = async (): Promise<string> => {
    const { _id: userId } = await modelUser.create(generateCreateUserParams());
    return userId.toString();
  };

  const generateAppointment = async ({
    memberId,
    userId,
    journeyId,
    start = date.soon(4),
    status = AppointmentStatus.scheduled,
  }: {
    memberId: string;
    userId: string;
    journeyId: string;
    start?: Date;
    status?: AppointmentStatus;
  }): Promise<AppointmentDocument> => {
    const scheduleParams = generateScheduleAppointmentParams({
      memberId,
      userId,
      journeyId,
      start,
    });
    const appointment = await modelAppointment.create({
      deleted: false,
      ...scheduleParams,
      memberId: new Types.ObjectId(scheduleParams.memberId),
      userId: new Types.ObjectId(scheduleParams.userId),
      journeyId: new Types.ObjectId(scheduleParams.journeyId),
      status,
    });
    await modelUser.updateOne(
      { _id: new Types.ObjectId(userId) },
      { $push: { appointments: new Types.ObjectId(appointment.id) } },
      { new: true },
    );
    await memberModel.updateOne(
      { _id: new Types.ObjectId(memberId) },
      { $addToSet: { users: new Types.ObjectId(userId) } },
    );
    return appointment;
  };
});
