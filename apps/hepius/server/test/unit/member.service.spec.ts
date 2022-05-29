import { Appointment, AppointmentStatus, Caregiver, User } from '@argus/hepiusClient';
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
import { add, sub } from 'date-fns';
import { address, datatype, date, internet, lorem, name } from 'faker';
import { isNil, omitBy, pickBy } from 'lodash';
import { Model, Types, model } from 'mongoose';
import { performance } from 'perf_hooks';
import { v4 } from 'uuid';
import {
  checkDelete,
  compareMembers,
  compareUsers,
  dbConnect,
  dbDisconnect,
  defaultModules,
  generateAddCaregiverParams,
  generateAddInsuranceParams,
  generateCreateMemberParams,
  generateCreateQuestionnaireParams,
  generateCreateUserParams,
  generateDateOnly,
  generateDeleteMemberParams,
  generateInternalCreateMemberParams,
  generateOrgParams,
  generateReplaceMemberOrgParams,
  generateScheduleAppointmentParams,
  generateUpdateCaregiverParams,
  generateUpdateMemberConfigParams,
  generateUpdateMemberParams,
  generateUpdateRecordingParams,
  generateUpdateRecordingReviewParams,
  loadSessionClient,
  mockGenerateDispatch,
  mockGenerateJourney,
  mockGenerateQuestionnaireItem,
  mockGenerateTodo,
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
  RecordingType,
  defaultTimestampsDbValues,
} from '../../src/common';
import { Audit } from '../../src/db';
import {
  CaregiverDocument,
  CaregiverDto,
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
  MemberRecordingDto,
  MemberService,
  NotNullableMemberKeys,
  Recording,
  RecordingDocument,
  Sex,
  UpdateMemberParams,
} from '../../src/member';
import { Journey, JourneyDocument, JourneyDto, ReadmissionRisk } from '../../src/journey';
import { Org, OrgDocument, OrgDto } from '../../src/org';
import { Internationalization } from '../../src/providers';
import {
  AlertConditionType,
  Questionnaire,
  QuestionnaireDocument,
  QuestionnaireDto,
  QuestionnaireResponse,
  QuestionnaireResponseDocument,
  QuestionnaireResponseDto,
  QuestionnaireType,
} from '../../src/questionnaire';
import { NotificationService } from '../../src/services';
import { Todo, TodoDocument, TodoDto } from '../../src/todo';
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
  let modelRecording: Model<RecordingDocument>;
  let modelCaregiver: Model<CaregiverDocument>;
  let modelQuestionnaire: Model<QuestionnaireDocument>;
  let modelQuestionnaireResponse: Model<QuestionnaireResponseDocument>;
  let modelTodo: Model<TodoDocument & defaultTimestampsDbValues>;
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
    modelRecording = model<RecordingDocument>(Recording.name, MemberRecordingDto);
    modelCaregiver = model<CaregiverDocument>(Caregiver.name, CaregiverDto);
    modelQuestionnaire = model<QuestionnaireDocument>(Questionnaire.name, QuestionnaireDto);
    modelQuestionnaireResponse = model<QuestionnaireResponseDocument>(
      QuestionnaireResponse.name,
      QuestionnaireResponseDto,
    );
    modelTodo = model<TodoDocument & defaultTimestampsDbValues>(Todo.name, TodoDto);
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

      const memberId1a = await generateMember(orgId1);
      const memberId1b = await generateMember(orgId1);

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

      const memberId1a = await generateMember(orgId1);
      const memberId1b = await generateMember(orgId1);
      const memberId2 = await generateMember(orgId2);

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

      const memberId = await generateMember(orgId, primaryUserId);
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

      // insert a deleted appointment - should not be counted
      const startUser3 = new Date();
      startUser3.setHours(startUser3.getHours() + 12);
      const deletedAppointment = await generateAppointment({
        userId: userId2,
        memberId,
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
      const memberId = await generateMember(orgId);
      const member = await service.get(memberId);

      const startDate1 = new Date();
      startDate1.setDate(startDate1.getDate() - (queryDaysLimit.getMembersAppointments + 1));
      // create a `scheduled` appointment for the member (and primary user)
      await generateAppointment({
        memberId,
        userId: member.primaryUserId.toString(),
        status: AppointmentStatus.scheduled,
        start: startDate1,
      });

      const startDate2 = new Date();
      startDate2.setDate(startDate2.getDate() - (queryDaysLimit.getMembersAppointments - 1));
      await generateAppointment({
        memberId,
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
      const id = await generateMember();

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
      const memberId = await generateMember();
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
      const memberId = await generateMember();
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
        const memberId = await generateMember();
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
      const memberId = await generateMember();
      const userId = generateId();
      const params = generateUpdateRecordingParams({ memberId });
      const params2 = generateUpdateRecordingParams({ memberId });
      const { id: recordingId } = await service.updateRecording(params, params.userId);
      await service.updateRecording(params2, params2.userId);

      const { id: caregiverId } = await service.addCaregiver(
        generateAddCaregiverParams({ memberId }),
      );
      await service.addCaregiver(generateAddCaregiverParams({ memberId }));

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
      // @ts-ignore
      const recordingDeletedResult = await modelRecording.findWithDeleted({
        memberId: new Types.ObjectId(memberId),
      });
      // @ts-ignore
      const caregiverDeletedResult = await modelCaregiver.findWithDeleted({
        memberId: new Types.ObjectId(memberId),
      });
      /* eslint-enable @typescript-eslint/ban-ts-comment */

      await checkDelete(memberDeletedResult, { _id: new Types.ObjectId(memberId) }, userId);
      await checkDelete(
        memberConfigDeletedResult,
        { memberId: new Types.ObjectId(memberId) },
        userId,
      );
      await checkDelete(recordingDeletedResult, { memberId: new Types.ObjectId(memberId) }, userId);
      await checkDelete(caregiverDeletedResult, { memberId: new Types.ObjectId(memberId) }, userId);

      const resultHard = await service.deleteMember(
        generateDeleteMemberParams({ id: memberId, hard: true }),
        userId,
      );
      expect(resultHard).toBeTruthy();

      /* eslint-disable @typescript-eslint/ban-ts-comment */
      // @ts-ignore
      const memberDeletedResultHard = await memberModel.findWithDeleted({
        _id: new Types.ObjectId(memberId),
      });
      // @ts-ignore
      const memberConfigDeletedResultHard = await memberConfigModel.findWithDeleted({
        memberId: new Types.ObjectId(memberId),
      });
      // @ts-ignore
      const recordingDeletedResultHard = await modelRecording.findWithDeleted({ id: recordingId });
      // @ts-ignore
      const caregiverDeletedResultHard = await modelCaregiver.findWithDeleted({ _id: caregiverId });
      /* eslint-enable @typescript-eslint/ban-ts-comment */
      [
        memberDeletedResultHard,
        memberConfigDeletedResultHard,
        recordingDeletedResultHard,
        caregiverDeletedResultHard,
      ].forEach((result) => {
        expect(result).toEqual([]);
      });
    });
  });

  describe('update', () => {
    it('should throw when trying to update non existing member', async () => {
      await expect(service.update({ id: generateId() })).rejects.toThrow(
        Errors.get(ErrorType.memberNotFound),
      );
    });

    it('should be able to update partial fields', async () => {
      await updateMember({
        fellowName: name.firstName(),
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

      const beforeObject = await memberModel.findById(id);

      await service.update({ id, ...updateMemberParams });
      const afterObject = await memberModel.findById(id);

      expect(afterObject.toJSON()).toEqual({
        ...beforeObject.toJSON(),
        ...updateMemberParams,
        readmissionRiskHistory: expect.any(Array),
        updatedAt: afterObject['updatedAt'],
      });
    };

    // eslint-disable-next-line max-len
    it('should not change address.state and address.street when address.city changes', async () => {
      const id = await generateMember();

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

  describe('caregivers', () => {
    let caregiverId;
    let mockEventEmitterEmit: jest.SpyInstance;

    beforeAll(() => {
      mockEventEmitterEmit = jest.spyOn(module.get<EventEmitter2>(EventEmitter2), `emit`);
    });

    afterEach(() => {
      mockEventEmitterEmit.mockReset();
    });

    it('should add a caregiver', async () => {
      const memberId = generateId();

      // start a session and set member id as client in store
      loadSessionClient(memberId);

      const caregiverParams = generateAddCaregiverParams({ memberId });
      const { id } = await service.addCaregiver(caregiverParams);

      caregiverId = id;

      confirmEmittedChangeEvent(
        mockEventEmitterEmit,
        createChangeEvent({
          action: ChangeEventType.updated,
          entity: EntityName.caregiver,
          memberId,
        }),
      );

      const caregiver = await service.getCaregiver(id);

      expect(caregiver).toEqual(
        expect.objectContaining({
          ...pickBy(
            caregiverParams,
            (value, key) => ['memberId', 'id', 'createdBy'].indexOf(key) >= 0,
          ),
          memberId: new Types.ObjectId(memberId),
          createdBy: new Types.ObjectId(memberId),
          updatedBy: new Types.ObjectId(memberId),
          _id: new Types.ObjectId(id),
        }),
      );
    });

    it('should update a caregiver', async () => {
      const memberId = generateId();
      const updateCaregiverParams = generateUpdateCaregiverParams({
        id: caregiverId,
        memberId,
      });

      // start a session and set member id as client in store
      loadSessionClient(memberId);

      const { id, createdBy } = (await service.updateCaregiver(
        updateCaregiverParams,
      )) as Caregiver & Audit;

      confirmEmittedChangeEvent(
        mockEventEmitterEmit,
        createChangeEvent({
          action: ChangeEventType.updated,
          entity: EntityName.caregiver,
          memberId,
        }),
      );

      const caregiver = await service.getCaregiver(id);
      expect(caregiver).toEqual(
        expect.objectContaining({
          ...pickBy(updateCaregiverParams, (value, key) => key !== 'id' && key !== 'memberId'),
          memberId: new Types.ObjectId(memberId),
          updatedBy: new Types.ObjectId(memberId),
          createdBy,
          _id: new Types.ObjectId(id),
        }),
      );
    });

    it('should (hard) delete a soft deleted caregiver', async () => {
      const memberId = generateId();
      const caregiverParams = generateAddCaregiverParams({ memberId });
      const { id } = await service.addCaregiver(caregiverParams);

      await service.deleteCaregiver(id, memberId.toString());
      await service.deleteCaregiver(id, memberId.toString(), true);

      confirmEmittedChangeEvent(
        mockEventEmitterEmit,
        createChangeEvent({
          action: ChangeEventType.deleted,
          entity: EntityName.caregiver,
          memberId,
        }),
      );

      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const deletedCaregiver = await modelCaregiver.findOneWithDeleted({
        _id: new Types.ObjectId(id),
      });

      expect(deletedCaregiver).toBeFalsy();
    });

    it('should get a caregiver by member id', async () => {
      const memberId = generateId();
      const updateCaregiverParams = generateUpdateCaregiverParams({ id: caregiverId, memberId });

      const caregiver = await service.updateCaregiver(updateCaregiverParams);

      expect(await service.getCaregiversByMemberId(memberId)).toEqual([caregiver]);
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

        member1 = await memberModel.findOne({
          _id: new Types.ObjectId(await generateMember(orgId, userId)),
        });

        member2 = await memberModel.findOne({
          _id: new Types.ObjectId(await generateMember(orgId, userId)),
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

    describe('entity based alerts', () => {
      it('should return appointment reviewed alerts', async () => {
        mockNotificationGetDispatchesByClientSenderId.mockResolvedValue(undefined);
        // create a new member
        const memberId = await generateMember();

        const member = await service.get(memberId);

        // Create a reviewed recording
        const recordingParams = generateUpdateRecordingParams({ memberId });
        const recording = await service.updateRecording(
          recordingParams,
          member.primaryUserId.toString(),
        );

        const recordingReviewParams = generateUpdateRecordingReviewParams({
          recordingId: recording.id,
        });
        await service.updateRecordingReview(recordingReviewParams, recordingParams.userId);

        const updatedRecording = await modelRecording.findOne({
          memberId: new Types.ObjectId(memberId),
        });

        // Create a recording without a review - we are not expecting to see this review alert
        await service.updateRecording(
          generateUpdateRecordingParams({ memberId }),
          member.primaryUserId.toString(),
        );

        const alerts = await service.getAlerts(member.primaryUserId.toString(), [member]);

        expect(alerts).toEqual([
          {
            id: `${recording.id}_${AlertType.appointmentReviewed}`,
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            text: service.internationalization.getAlerts(AlertType.appointmentReviewed, { member }),
            memberId: member.id.toString(),
            type: AlertType.appointmentReviewed,
            date: updatedRecording.review.createdAt,
            dismissed: false,
            isNew: true,
          },
          {
            id: `${memberId}_${AlertType.memberAssigned}`,
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            text: service.internationalization.getAlerts(AlertType.memberAssigned, { member }),
            memberId: member.id.toString(),
            type: AlertType.memberAssigned,
            date: member.createdAt,
            dismissed: false,
            isNew: true,
          },
        ]);
      });

      it('should return appointment submit overdue alerts', async () => {
        mockNotificationGetDispatchesByClientSenderId.mockResolvedValue(undefined);
        // create a new member
        const memberId = await generateMember();

        const member = await service.get(memberId);

        // create a `scheduled` appointment for the member (and primary user)
        const { id: appointmentId } = await generateAppointment({
          memberId,
          userId: member.primaryUserId.toString(),
          status: AppointmentStatus.scheduled,
        });

        const endDate = sub(new Date(), { days: 2 });
        // set an `end` date over 24hrs ago (2 days ago)
        await modelAppointment.updateOne(
          { _id: new Types.ObjectId(appointmentId) },
          { $set: { end: endDate } },
        );

        const alerts = await service.getAlerts(member.primaryUserId.toString(), [member]);

        expect(alerts).toEqual([
          {
            id: `${memberId}_${AlertType.memberAssigned}`,
            memberId: member.id.toString(),
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            text: service.internationalization.getAlerts(AlertType.memberAssigned, { member }),
            type: AlertType.memberAssigned,
            date: member.createdAt,
            dismissed: false,
            isNew: true,
          },
          {
            id: `${appointmentId}_${AlertType.appointmentSubmitOverdue}`,
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            text: service.internationalization.getAlerts(AlertType.appointmentSubmitOverdue, {
              member,
            }),
            memberId: member.id.toString(),
            type: AlertType.appointmentSubmitOverdue,
            date: add(endDate, { days: 1 }),
            dismissed: false,
            isNew: true,
          },
        ]);
      });

      it.each([
        [
          'should return score over threshold assessment alerts - total score over threshold',
          '2',
          '2',
        ],
        [
          'should return score over threshold assessment alerts - alert triggered by answer',
          '3',
          'Nearly Every Day',
        ],
        ['should not return any alerts for assessments', '1', undefined],
      ])('%p', async (_, answer, expectedScore) => {
        mockNotificationGetDispatchesByClientSenderId.mockResolvedValue(undefined);
        // create a new member
        const memberId = await generateMember();
        const member = await service.get(memberId);
        const expectedAlerts = [];

        const { id: questionnaireId } = await modelQuestionnaire.create(
          generateCreateQuestionnaireParams({
            type: QuestionnaireType.phq9,
            shortName: 'PHQ-9',
            items: [
              mockGenerateQuestionnaireItem({
                code: 'q1',
                options: [
                  { label: lorem.words(3), value: 0 },
                  { label: lorem.words(3), value: 1 },
                  { label: lorem.words(3), value: 2 },
                  { label: lorem.words(3), value: 3 },
                ],
                alertCondition: [{ type: AlertConditionType.equal, value: '3' }],
              }),
            ],
            notificationScoreThreshold: 2,
          }),
        );

        const qr = await modelQuestionnaireResponse.create({
          questionnaireId,
          memberId: new Types.ObjectId(memberId),
          answers: [{ code: 'q1', value: answer }],
        });

        const alerts = await service.getAlerts(member.primaryUserId.toString(), [member]);

        if (expectedScore !== undefined) {
          expectedAlerts.push({
            id: `${qr.id.toString()}_${AlertType.assessmentSubmitScoreOverThreshold}`,
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            text: service.internationalization.getAlerts(
              AlertType.assessmentSubmitScoreOverThreshold,
              {
                member,
                assessmentName: 'PHQ-9',
                assessmentScore: expectedScore,
              },
            ),
            memberId,
            type: AlertType.assessmentSubmitScoreOverThreshold,
            date: qr.createdAt,
            dismissed: false,
            isNew: true,
          });
        }

        expectedAlerts.push({
          id: `${memberId}_${AlertType.memberAssigned}`,
          memberId,
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          text: service.internationalization.getAlerts(AlertType.memberAssigned, { member }),
          type: AlertType.memberAssigned,
          date: member.createdAt,
          dismissed: false,
          isNew: true,
        });

        expect(alerts).toEqual(expectedAlerts);
      });
    });

    describe('todos alerts', () => {
      it('should return todos created by member alerts', async () => {
        mockNotificationGetDispatchesByClientSenderId.mockResolvedValue(undefined);
        // create a new member
        const memberId = await generateMember();

        const member = await service.get(memberId);

        const mockTodo = mockGenerateTodo({
          memberId: generateObjectId(memberId),
          createdBy: generateObjectId(memberId),
          updatedBy: generateObjectId(memberId),
        });
        delete mockTodo.id;

        const todo = await modelTodo.create(mockTodo);

        const alerts = await service.getAlerts(member.primaryUserId.toString(), [member]);

        expect(alerts).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              id: `${todo.id}_${AlertType.memberCreateTodo}`,
              type: AlertType.memberCreateTodo,
              date: todo.createdAt,
              // eslint-disable-next-line @typescript-eslint/ban-ts-comment
              // @ts-ignore
              text: service.internationalization.getAlerts(AlertType.memberCreateTodo, {
                member,
                todoText: todo.text,
              }),
              memberId: member.id,
              dismissed: false,
              isNew: true,
            }),
          ]),
        );
      });
    });

    it('should not return todos created by member if they are related alerts', async () => {
      mockNotificationGetDispatchesByClientSenderId.mockResolvedValue(undefined);
      // create a new member
      const memberId = await generateMember();

      const member = await service.get(memberId);

      const mockTodo = mockGenerateTodo({
        memberId: generateObjectId(memberId),
        createdBy: generateObjectId(memberId),
        updatedBy: generateObjectId(memberId),
      });
      mockTodo.relatedTo = generateObjectId();
      delete mockTodo.id;

      const todo = await modelTodo.create(mockTodo);

      const alerts = await service.getAlerts(member.primaryUserId.toString(), [member]);

      expect(alerts).toEqual(
        expect.not.arrayContaining([
          expect.objectContaining({
            id: `${todo.id}_${AlertType.memberCreateTodo}`,
            type: AlertType.memberCreateTodo,
            date: todo.createdAt,
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            text: service.internationalization.getAlerts(AlertType.memberCreateTodo, {
              member,
              todoText: todo.text,
            }),
            memberId: member.id,
            dismissed: false,
            isNew: true,
          }),
        ]),
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
      { isTodoNotificationsEnabled: null },
      { language: null },
      { systemVersion: null },
      { brand: null },
      { codePushVersion: null },
      { appVersion: null },
      { buildVersion: null },
    ])('should not override %p since it is not define in input', async (field) => {
      const id = await generateMember();
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
      const id = await generateMember();
      const CreatedConfigMember = await service.getMemberConfig(id);

      expect(id).toEqual(CreatedConfigMember.memberId.toString());
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
          memberId: new Types.ObjectId(id),
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

      expect(memberConfig.articlesPath).toEqual(articlesByDrg.default);
    });

    it('should return the configured path for a configured drg', async () => {
      const id = await generateMember();
      const updateMemberParams = generateUpdateMemberParams({ id, drg: '123' });
      await service.update({ id, ...updateMemberParams });

      const memberConfig = await service.getMemberConfig(id);

      expect(memberConfig.articlesPath).toEqual(articlesByDrg['123']);
    });
  });

  describe('updateRecording + getRecordings', () => {
    it('should fail to update recording on non existing member', async () => {
      await expect(
        service.updateRecording(generateUpdateRecordingParams(), generateId()),
      ).rejects.toThrow(Errors.get(ErrorType.memberNotFound));
    });

    it('should fail to update an existing id for different member', async () => {
      const userId = generateId();
      const memberId1 = await generateMember();
      const params1 = generateUpdateRecordingParams({ memberId: memberId1 });
      const recording1 = await service.updateRecording(params1, userId);

      const memberId2 = await generateMember();
      const recording2 = generateUpdateRecordingParams({ id: recording1.id, memberId: memberId2 });
      await expect(service.updateRecording(recording2, userId)).rejects.toThrow(
        Errors.get(ErrorType.memberRecordingSameUserEdit),
      );
    });

    it('should insert recording if id does not exist', async () => {
      const memberId = await generateMember();
      const params = generateUpdateRecordingParams({ memberId, id: v4() });
      const result = await service.updateRecording(params, params.userId);
      expect(result).toEqual(
        expect.objectContaining(
          omitBy({ ...params, memberId: new Types.ObjectId(params.memberId) }, isNil),
        ),
      );
    });

    it('should create a member recording with undefined id on 1st time', async () => {
      const memberId = await generateMember();
      const params = generateUpdateRecordingParams({ memberId });
      params.id = undefined;
      const result = await service.updateRecording(params, params.userId);
      expect(result).toEqual(
        expect.objectContaining(
          omitBy({ ...params, memberId: new Types.ObjectId(params.memberId) }, isNil),
        ),
      );
    });

    it('should update a member recording', async () => {
      const memberId = await generateMember();
      const params = generateUpdateRecordingParams({ memberId });
      const recording = await service.updateRecording(params, params.userId);

      const recordings = await service.getRecordings(memberId);
      expect(recordings.length).toEqual(1);
      expect(recordings[0].id).toEqual(recording.id);
      expect(recordings[0]).toEqual(
        expect.objectContaining(
          omitBy({ ...params, memberId: new Types.ObjectId(params.memberId) }, isNil),
        ),
      );
    });

    test.each(['start', 'end', 'userId', 'phone', 'answered', 'recordingType', 'appointmentId'])(
      'should not override optional field %p when not set from params',
      async (param) => {
        const memberId = await generateMember();
        const params1 = generateUpdateRecordingParams({
          memberId,
          appointmentId: generateId(),
          recordingType: RecordingType.phone,
        });
        const { id } = await service.updateRecording(params1, params1.userId);
        const params2 = generateUpdateRecordingParams({ id, memberId });
        delete params2[param];
        await service.updateRecording(params2, params2.userId);

        const recordings = await service.getRecordings(memberId);
        expect(recordings.length).toEqual(1);
        expect(recordings[0][param]).toEqual(
          param === 'appointmentId' ? new Types.ObjectId(params1.appointmentId) : params1[param],
        );
      },
    );

    it('should multiple update members recordings', async () => {
      const memberId1 = await generateMember();
      const params1a = generateUpdateRecordingParams({ memberId: memberId1 });
      const recording1a = await service.updateRecording(params1a, params1a.userId);
      const params1b = generateUpdateRecordingParams({ memberId: memberId1 });
      params1b.end = undefined;
      const recording1b = await service.updateRecording(params1b, params1b.userId);
      const memberId2 = await generateMember();
      const params2 = generateUpdateRecordingParams({ memberId: memberId2 });
      const recording2 = await service.updateRecording(params2, params2.userId);

      const recordings1 = await service.getRecordings(memberId1);
      expect(recordings1.length).toEqual(2);
      expect(recordings1[0]).toEqual(expect.objectContaining(recording1a));
      expect(recordings1[1]).toEqual(expect.objectContaining(recording1b));

      const recordings2 = await service.getRecordings(memberId2);
      expect(recordings2.length).toEqual(1);
      expect(recordings2[0]).toEqual(expect.objectContaining(recording2));
    });
  });

  describe('updateRecordingReview', () => {
    it('should fail to update review on non existing member', async () => {
      await expect(
        service.updateRecordingReview(generateUpdateRecordingReviewParams(), generateId()),
      ).rejects.toThrow(Errors.get(ErrorType.memberRecordingNotFound));
    });

    it('should fail to update review if user created recording', async () => {
      const memberId = await generateMember();
      const params = generateUpdateRecordingParams({ memberId });
      const recording = await service.updateRecording(params, params.userId);

      await expect(
        service.updateRecordingReview(
          generateUpdateRecordingReviewParams({ recordingId: recording.id }),
          recording.userId,
        ),
      ).rejects.toThrow(Errors.get(ErrorType.memberRecordingSameUser));
    });

    it('should fail to update review if different user wrote review', async () => {
      const userId1 = generateId();
      const userId2 = generateId();

      const memberId = await generateMember();
      const params1 = generateUpdateRecordingParams({ memberId });
      const recording = await service.updateRecording(params1, params1.userId);

      const paramsReview = generateUpdateRecordingReviewParams({ recordingId: recording.id });
      await service.updateRecordingReview(paramsReview, userId1);

      await expect(
        service.updateRecordingReview(
          generateUpdateRecordingReviewParams({ recordingId: paramsReview.recordingId }),
          userId2,
        ),
      ).rejects.toThrow(Errors.get(ErrorType.memberRecordingSameUserEdit));
    });

    it('should create a review', async () => {
      const memberId = await generateMember();
      const params = generateUpdateRecordingParams({ memberId });
      const recording = await service.updateRecording(params, params.userId);

      const userId = generateId();
      const paramsReview = generateUpdateRecordingReviewParams({ recordingId: recording.id });
      await service.updateRecordingReview(paramsReview, userId);

      const recordings = await service.getRecordings(memberId);
      const { review } = recordings[0];

      expect(review.content).toEqual(paramsReview.content);
      expect(review.userId.toString()).toEqual(userId);
      expect(review.createdAt).toBeInstanceOf(Date);
      expect(review.createdAt).toEqual(review.updatedAt);
    });

    it('should update a review', async () => {
      const memberId = await generateMember();
      const params = generateUpdateRecordingParams({ memberId });
      const recording = await service.updateRecording(params, params.userId);

      const userId = generateId();
      const paramsReview = generateUpdateRecordingReviewParams({ recordingId: recording.id });
      await service.updateRecordingReview(paramsReview, userId);

      const newParams = generateUpdateRecordingReviewParams({ recordingId: recording.id });
      await service.updateRecordingReview(newParams, userId);

      const recordings = await service.getRecordings(memberId);
      const { review } = recordings[0];

      expect(review.content).toEqual(newParams.content);
      expect(review.updatedAt).toBeInstanceOf(Date);
      expect(review.createdAt).not.toEqual(review.updatedAt);
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
      const memberId = await generateMember(orgId);
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

  const generateMember = async (orgId?: string, userId?: string): Promise<string> => {
    orgId = orgId ? orgId : await generateOrg();
    userId = userId ? userId : await generateUser();
    const createMemberParams = generateCreateMemberParams({ orgId });
    const { member } = await service.insert(
      { ...createMemberParams, phoneType: 'mobile' },
      new Types.ObjectId(userId),
    );
    await modelJourney.create(mockGenerateJourney({ memberId: member.id }));
    return member.id;
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
    start = date.soon(4),
    status = AppointmentStatus.scheduled,
  }: {
    memberId: string;
    userId: string;
    start?: Date;
    status?: AppointmentStatus;
  }): Promise<AppointmentDocument> => {
    const scheduleParams = generateScheduleAppointmentParams({ memberId, userId, start });
    const appointment = await modelAppointment.create({
      deleted: false,
      ...scheduleParams,
      memberId: new Types.ObjectId(scheduleParams.memberId),
      userId: new Types.ObjectId(scheduleParams.userId),
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
