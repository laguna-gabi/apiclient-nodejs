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
import { articlesByDrg } from 'config';
import { sub } from 'date-fns';
import { address, datatype, date, internet, name } from 'faker';
import { Model, Types, model } from 'mongoose';
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
  generateScheduleAppointmentParams,
  generateUpdateMemberConfigParams,
  generateUpdateMemberParams,
  loadSessionClient,
  mockGenerateDispatch,
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
import { JourneyService } from '../../src/journey';
import {
  ControlMember,
  ControlMemberDocument,
  ControlMemberDto,
  Honorific,
  Insurance,
  InsuranceDocument,
  InsuranceDto,
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
  let journeyService: JourneyService;
  let memberModel: Model<MemberDocument & defaultTimestampsDbValues>;
  let memberConfigModel: Model<MemberConfigDocument>;
  let controlMemberModel: Model<ControlMemberDocument & defaultTimestampsDbValues>;
  let modelUser: Model<UserDocument>;
  let modelOrg: Model<OrgDocument>;
  let modelAppointment: Model<AppointmentDocument>;
  let modelDismissedAlert: Model<DismissedAlertDocument>;
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
    journeyService = module.get<JourneyService>(JourneyService);

    memberConfigModel = model<MemberConfigDocument>(MemberConfig.name, MemberConfigDto);
    controlMemberModel = model<ControlMemberDocument & defaultTimestampsDbValues>(
      ControlMember.name,
      ControlMemberDto,
    );
    modelUser = model<UserDocument>(User.name, UserDto);
    modelOrg = model<OrgDocument>(Org.name, OrgDto);
    modelAppointment = model<AppointmentDocument>(Appointment.name, AppointmentDto);
    modelDismissedAlert = model<DismissedAlertDocument>(DismissedAlert.name, DismissedAlertDto);
    modelInsurance = model<InsuranceDocument>(Insurance.name, InsuranceDto);

    await dbConnect();
  });

  afterAll(async () => {
    await module.close();
    await dbDisconnect();
  });

  describe('get', () => {
    it('should throw error on a non existing id of a member', async () => {
      await expect(service.get(generateId())).rejects.toThrow(Errors.get(ErrorType.memberNotFound));
    });

    test.each`
      field   | method
      ${'id'} | ${(id) => service.get(id)}
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
          primaryUserId: primaryUser.id,
          users: [primaryUser.id],
        });
        await journeyService.create({ memberId: _id, orgId: org.id });

        const result = await params.method(params.field === 'context' ? deviceId : _id);

        expect(result.id).toEqual(_id);
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
        primaryUserId: primaryUser.id,
        users: [primaryUser.id],
      });
      await journeyService.create({ memberId: _id, orgId: org.id });

      const result = await service.getByPhone(member.phone);

      expect(result.id).toEqual(_id);
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
      await journeyService.create({ memberId: _id, orgId: org.id });

      const result = await service.getByPhone(member.phone);

      expect(result.id).toEqual(_id);
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
      const result = await service.getByOrgs([generateId()]);
      expect(result).toEqual([]);
    });

    it('should return empty list for no members on org', async () => {
      const orgId = await generateOrg();
      const result = await service.getByOrgs([orgId]);
      expect(result).toEqual([]);
    });

    it('should return only 2 members which are within an orgId', async () => {
      const orgId1 = await generateOrg();
      const orgId2 = await generateOrg();

      const { memberId: memberId1a } = await generateMember(orgId1);
      const { memberId: memberId1b } = await generateMember(orgId1);

      await generateMember(orgId2);

      const result = await service.getByOrgs([orgId1]);
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

      const result = await service.getByOrgs();
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
      const result = await service.getByOrgs([orgId]);
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

      const { id: memberId } = await service.insert(
        { ...generateCreateMemberParams({ orgId }), phoneType },
        new Types.ObjectId(primaryUserId),
      );
      await journeyService.create({ memberId, orgId });

      const result = await service.getByOrgs([orgId]);
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

      const result = await service.getByOrgs([orgId]);
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

      const result = await service.getByOrgs([orgId]);
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

      const result = await service.getByOrgs([orgId]);
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

      const result = await service.getByOrgs([orgId]);
      expect(result.length).toEqual(1);
      expect(result[0]).toEqual(
        expect.objectContaining({
          nextAppointment: appointment.start,
          appointmentsCount: 1,
        }),
      );
    });
  });

  describe('insert', () => {
    it('should insert a member without optional params + validate all fields', async () => {
      const primaryUser = await modelUser.create(generateCreateUserParams());

      const createMemberParams = generateInternalCreateMemberParams();
      createMemberParams.zipCode = undefined;
      const { id } = await service.insert(createMemberParams, primaryUser._id);

      expect(id).not.toBeUndefined();

      const createdMember = await memberModel.findById(id);
      compareMembers(createdMember, createMemberParams);
    });

    it('should insert a member with all params + validate all insert fields', async () => {
      const primaryUser = await modelUser.create(generateCreateUserParams());

      const createMemberParams = generateInternalCreateMemberParams({
        sex: Sex.female,
        email: internet.email(),
        language: Language.es,
        zipCode: generateZipCode(),
        honorific: Honorific.dr,
      });
      const { id } = await service.insert(createMemberParams, primaryUser._id);

      expect(id).not.toBeUndefined();

      const createdMember = await memberModel.findById(id);
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

      const createMemberParams = generateInternalCreateMemberParams();

      NotNullableMemberKeys.forEach((key) => {
        createMemberParams[key] = null;
      });

      createMemberParams.firstName = name.firstName();
      createMemberParams.lastName = name.lastName();
      createMemberParams.dateOfBirth = generateDateOnly(date.past());

      const { id } = await service.insert(createMemberParams, primaryUser._id);
      const createdObject = await memberModel.findById(id);

      NotNullableMemberKeys.forEach((key) => {
        expect(createdObject).not.toHaveProperty(key, null);
      });
    });

    it('should insert a member even with primaryUser not exists', async () => {
      const params = generateInternalCreateMemberParams();
      const { id } = await service.insert(params, new Types.ObjectId(generateId()));

      expect(id).not.toBeUndefined();
    });

    it('should fail to insert an already existing member', async () => {
      const primaryUserId = generateId();
      const createMemberParams = generateInternalCreateMemberParams();
      await service.insert(createMemberParams, new Types.ObjectId(primaryUserId));

      await expect(
        service.insert(createMemberParams, new Types.ObjectId(primaryUserId)),
      ).rejects.toThrow(Errors.get(ErrorType.memberPhoneAlreadyExists));
    });
  });

  describe('control member', () => {
    it('should insert control member with mandatory params+validate all fields', async () => {
      const createMemberParams = generateInternalCreateMemberParams();
      const member = await service.insertControl(createMemberParams);
      const createdMember = await controlMemberModel.findById(member.id);
      compareMembers(createdMember, createMemberParams);
    });

    it('should fail to insert an already existing member', async () => {
      const params = generateInternalCreateMemberParams();
      await service.insertControl(params);

      await expect(service.insertControl(params)).rejects.toThrow(
        Errors.get(ErrorType.memberPhoneAlreadyExists),
      );
    });

    it('should remove not nullable optional params if null is passed', async () => {
      const createMemberParams = generateInternalCreateMemberParams();

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
      const createMemberParams = generateInternalCreateMemberParams();
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
      const { memberId, userId } = await generateMember();
      const member = await service.get(memberId);
      const memberConfig = await service.getMemberConfig(memberId);

      const deleteMemberParams = generateDeleteMemberParams({ id: memberId, hard: false });
      const result = await service.deleteMember(deleteMemberParams, userId);
      expect(result.member).toEqual(
        expect.objectContaining({
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
      const createdConfigMember = await service.getMemberConfig(id);

      expect(id).toEqual(createdConfigMember.memberId);
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
  ): Promise<{ memberId: string; journeyId: string; userId: string }> => {
    orgId = orgId ? orgId : await generateOrg();
    userId = userId ? userId : await generateUser();
    const createMemberParams = generateCreateMemberParams({ orgId });
    delete createMemberParams.orgId;
    const { id: memberId } = await service.insert(
      { ...createMemberParams, phoneType: 'mobile' },
      new Types.ObjectId(userId),
    );
    const { id: journeyId } = await journeyService.create({ memberId, orgId });

    return { memberId, journeyId, userId };
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
