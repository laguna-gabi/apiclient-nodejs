import {
  ExternalKey,
  IEventNotifySlack,
  NotificationType,
  Platform,
  QueueType,
  SlackChannel,
  SlackIcon,
  mockLogger,
  mockProcessWarnings,
} from '@lagunahealth/pandora';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import * as faker from 'faker';
import { Types } from 'mongoose';
import { v4 } from 'uuid';
import {
  ErrorType,
  Errors,
  EventType,
  IEventDeleteMember,
  IEventNotifyQueue,
  IEventOnAlertForQRSubmit,
  IEventOnNewMember,
  IEventOnReceivedChatMessage,
  IEventOnUpdatedMemberPlatform,
  LoggerService,
  MemberRole,
  PhoneType,
  RegisterForNotificationParams,
  StorageType,
  UserRole,
  delay,
} from '../../src/common';
import {
  Communication,
  CommunicationResolver,
  CommunicationService,
} from '../../src/communication';
import {
  AudioFormat,
  AudioType,
  ImageFormat,
  ImageType,
  Journal,
  Member,
  MemberConfig,
  MemberModule,
  MemberResolver,
  MemberService,
  TaskStatus,
  defaultMemberParams,
} from '../../src/member';
import {
  CognitoService,
  FeatureFlagService,
  OneSignal,
  StorageService,
  TwilioService,
} from '../../src/providers';
import { UserService } from '../../src/user';
import {
  dbDisconnect,
  defaultModules,
  generateAddCaregiverParams,
  generateAppointmentComposeParams,
  generateCommunication,
  generateCreateMemberParams,
  generateCreateTaskParams,
  generateDeleteMemberParams,
  generateEndAppointmentParams,
  generateGetMemberUploadJournalAudioLinkParams,
  generateGetMemberUploadJournalImageLinkParams,
  generateId,
  generateMemberConfig,
  generateNotifyContentParams,
  generateNotifyParams,
  generateObjectId,
  generateScheduleAppointmentParams,
  generateSetGeneralNotesParams,
  generateUniqueUrl,
  generateUpdateCaregiverParams,
  generateUpdateClientSettings,
  generateUpdateJournalTextParams,
  generateUpdateMemberConfigParams,
  generateUpdateMemberParams,
  generateUpdateRecordingParams,
  generateUpdateTaskStatusParams,
  mockGenerateAlert,
  mockGenerateMember,
  mockGenerateMemberConfig,
  mockGenerateUser,
} from '../index';

describe('MemberResolver', () => {
  let module: TestingModule;
  let resolver: MemberResolver;
  let service: MemberService;
  let userService: UserService;
  let storage: StorageService;
  let cognitoService: CognitoService;
  let communicationResolver: CommunicationResolver;
  let oneSignal: OneSignal;
  let communicationService: CommunicationService;
  let eventEmitter: EventEmitter2;
  let featureFlagService: FeatureFlagService;
  let twilioService: TwilioService;
  let spyOnEventEmitter;

  beforeAll(async () => {
    mockProcessWarnings(); // to hide pino prettyPrint warning
    module = await Test.createTestingModule({
      imports: defaultModules().concat(MemberModule),
    }).compile();

    resolver = module.get<MemberResolver>(MemberResolver);
    service = module.get<MemberService>(MemberService);
    userService = module.get<UserService>(UserService);
    userService = module.get<UserService>(UserService);
    storage = module.get<StorageService>(StorageService);
    cognitoService = module.get<CognitoService>(CognitoService);
    oneSignal = module.get<OneSignal>(OneSignal);
    communicationResolver = module.get<CommunicationResolver>(CommunicationResolver);
    communicationService = module.get<CommunicationService>(CommunicationService);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
    spyOnEventEmitter = jest.spyOn(eventEmitter, 'emit');
    featureFlagService = module.get<FeatureFlagService>(FeatureFlagService);
    twilioService = module.get<TwilioService>(TwilioService);
    mockLogger(module.get<LoggerService>(LoggerService));
  });

  afterAll(async () => {
    await module.close();
    await dbDisconnect();
  });

  afterEach(() => {
    spyOnEventEmitter.mockReset();
  });

  describe('createMember', () => {
    let spyOnServiceInsert;
    let spyOnServiceInsertControl;
    let spyOnServiceGetAvailableUser;
    let spyOnUserServiceGetUser;
    let spyOnServiceGetMemberConfig;
    let spyOnFeatureFlagControlGroup;
    let spyOnTwilioGetPhoneType;

    beforeEach(() => {
      spyOnServiceInsert = jest.spyOn(service, 'insert');
      spyOnServiceInsertControl = jest.spyOn(service, 'insertControl');
      spyOnServiceGetAvailableUser = jest.spyOn(userService, 'getAvailableUser');
      spyOnUserServiceGetUser = jest.spyOn(userService, 'get');
      spyOnServiceGetMemberConfig = jest.spyOn(service, 'getMemberConfig');
      spyOnFeatureFlagControlGroup = jest.spyOn(featureFlagService, 'isControlGroup');
      spyOnTwilioGetPhoneType = jest.spyOn(twilioService, 'getPhoneType');
    });

    afterEach(() => {
      spyOnServiceInsert.mockReset();
      spyOnServiceInsertControl.mockReset();
      spyOnServiceGetAvailableUser.mockReset();
      spyOnUserServiceGetUser.mockReset();
      spyOnServiceGetMemberConfig.mockReset();
      spyOnEventEmitter.mockReset();
      spyOnFeatureFlagControlGroup.mockReset();
      spyOnTwilioGetPhoneType.mockReset();
    });

    it('should create a member', async () => {
      const member = mockGenerateMember();
      const user = mockGenerateUser();
      const memberConfig = generateMemberConfig({
        memberId: generateObjectId(member.id),
        platform: Platform.android,
      });
      const phoneType: PhoneType = 'mobile';
      spyOnServiceInsert.mockImplementationOnce(async () => ({ member, memberConfig }));
      spyOnServiceGetMemberConfig.mockImplementationOnce(async () => memberConfig);
      spyOnServiceGetAvailableUser.mockImplementationOnce(async () => member.primaryUserId);
      spyOnUserServiceGetUser.mockImplementationOnce(async () => user);
      spyOnFeatureFlagControlGroup.mockImplementationOnce(async () => false);
      spyOnTwilioGetPhoneType.mockResolvedValueOnce(phoneType);

      const params = generateCreateMemberParams({ orgId: generateId() });
      await resolver.createMember(params);

      expect(spyOnServiceInsert).toBeCalledTimes(1);
      expect(spyOnServiceInsert).toBeCalledWith({ ...params, phoneType }, member.primaryUserId);
      expect(spyOnServiceGetAvailableUser).toBeCalledTimes(1);
      expect(spyOnServiceGetMemberConfig).toBeCalledTimes(1);
      expect(spyOnServiceGetMemberConfig).toBeCalledWith(member.id);
      expect(spyOnTwilioGetPhoneType).toBeCalledWith(params.phone);
      const eventNewMemberParams: IEventOnNewMember = {
        member,
        user,
        platform: memberConfig.platform,
      };

      expect(spyOnEventEmitter).toBeCalledTimes(3);
      const eventNotifyQueue: IEventNotifyQueue = {
        type: QueueType.notifications,
        message: JSON.stringify(generateUpdateClientSettings({ member, memberConfig })),
      };
      expect(spyOnEventEmitter).toHaveBeenNthCalledWith(1, EventType.notifyQueue, eventNotifyQueue);
      expect(spyOnEventEmitter).toHaveBeenNthCalledWith(
        2,
        EventType.onNewMember,
        eventNewMemberParams,
      );
      const eventSlackMessageParams: IEventNotifySlack = {
        /* eslint-disable-next-line max-len */
        header: `*New _real_ member*`,
        message: `${member.firstName} [${member.id}]\nAssigned to ${user.firstName}`,
        icon: SlackIcon.info,
        channel: SlackChannel.support,
        orgName: member.org.name,
      };
      expect(spyOnEventEmitter).toHaveBeenNthCalledWith(
        3,
        EventType.notifySlack,
        eventSlackMessageParams,
      );
    });

    it('should create a member with a requested user id', async () => {
      const member = mockGenerateMember();
      const user = mockGenerateUser();
      const memberConfig = {
        memberId: member.id,
        userId: member.primaryUserId,
        platform: Platform.android,
      };
      const phoneType: PhoneType = 'landline';
      spyOnServiceInsert.mockImplementationOnce(async () => ({ member, memberConfig }));
      spyOnServiceGetMemberConfig.mockImplementationOnce(async () => memberConfig);
      spyOnServiceGetAvailableUser.mockImplementationOnce(async () => member.primaryUserId);
      spyOnUserServiceGetUser.mockImplementationOnce(async () => user);
      //forcing true to be sure it won't be control member, even if control rolled true.
      spyOnFeatureFlagControlGroup.mockImplementationOnce(async () => true);
      spyOnTwilioGetPhoneType.mockResolvedValueOnce(phoneType);

      const params = generateCreateMemberParams({ orgId: generateId(), userId: user.id });
      await resolver.createMember(params);

      expect(spyOnServiceInsert).toBeCalledTimes(1);
      expect(spyOnServiceInsert).toBeCalledWith({ ...params, phoneType }, Types.ObjectId(user.id));
      expect(spyOnServiceGetMemberConfig).toBeCalledTimes(1);
      expect(spyOnServiceGetMemberConfig).toBeCalledWith(member.id);
      const eventNewMemberParams: IEventOnNewMember = {
        member,
        user,
        platform: memberConfig.platform,
      };
      expect(spyOnEventEmitter).toBeCalledWith(EventType.onNewMember, eventNewMemberParams);
      const eventSlackMessageParams: IEventNotifySlack = {
        /* eslint-disable-next-line max-len */
        header: `*New _real_ member*`,
        message: `${member.firstName} [${member.id}]\nAssigned to ${user.firstName}`,
        icon: SlackIcon.info,
        channel: SlackChannel.support,
        orgName: member.org.name,
      };
      expect(spyOnEventEmitter).toBeCalledWith(EventType.notifySlack, eventSlackMessageParams);
    });

    it('should create a control member', async () => {
      const member = mockGenerateMember();
      const phoneType: PhoneType = 'mobile';
      spyOnServiceInsertControl.mockImplementationOnce(async () => member);
      spyOnFeatureFlagControlGroup.mockImplementationOnce(async () => true);
      spyOnTwilioGetPhoneType.mockResolvedValueOnce(phoneType);

      const params = generateCreateMemberParams({ orgId: generateId() });
      await resolver.createMember(params);

      expect(spyOnServiceInsertControl).toBeCalledTimes(1);
      expect(spyOnServiceInsertControl).toBeCalledWith({ ...params, phoneType });
      const eventNotifyQueue: IEventNotifyQueue = {
        type: QueueType.notifications,
        message: JSON.stringify(generateUpdateClientSettings({ member })),
      };
      expect(spyOnEventEmitter).toHaveBeenCalledWith(EventType.notifyQueue, eventNotifyQueue);

      const eventSlackMessageParams: IEventNotifySlack = {
        /* eslint-disable-next-line max-len */
        header: `*New _control_ member*`,
        message: `${member.firstName} [${member.id}]`,
        icon: SlackIcon.info,
        channel: SlackChannel.support,
        orgName: member.org.name,
      };
      expect(spyOnEventEmitter).toHaveBeenCalledWith(
        EventType.notifySlack,
        eventSlackMessageParams,
      );
    });
  });

  describe('updateMember', () => {
    let spyOnServiceUpdate;
    let spyOnTwilioGetPhoneType;

    beforeEach(() => {
      spyOnServiceUpdate = jest.spyOn(service, 'update');
      spyOnTwilioGetPhoneType = jest.spyOn(twilioService, 'getPhoneType');
    });

    afterEach(() => {
      spyOnServiceUpdate.mockReset();
      spyOnTwilioGetPhoneType.mockReset();
    });

    test.each(['mobile', 'landline', 'voip'])(
      `should update a member with phoneSecondary and phoneSecondaryType=%p`,
      async (phoneSecondaryType) => {
        const updateMemberParams = generateUpdateMemberParams();
        spyOnServiceUpdate.mockImplementationOnce(async () => ({ ...updateMemberParams }));
        spyOnTwilioGetPhoneType.mockResolvedValueOnce(phoneSecondaryType);

        await resolver.updateMember(updateMemberParams);

        expect(spyOnServiceUpdate).toBeCalledTimes(1);
        expect(spyOnServiceUpdate).toBeCalledWith({
          ...updateMemberParams,
          phoneSecondaryType,
        });
      },
    );

    it('should update a member without phoneSecondary and phoneSecondaryType', async () => {
      const updateMemberParams = generateUpdateMemberParams();
      updateMemberParams.phoneSecondary = undefined;
      spyOnServiceUpdate.mockImplementationOnce(async () => ({ ...updateMemberParams }));

      await resolver.updateMember(updateMemberParams);

      expect(spyOnServiceUpdate).toBeCalledTimes(1);
      expect(spyOnTwilioGetPhoneType).not.toBeCalled();
      expect(spyOnServiceUpdate).toBeCalledWith(updateMemberParams);
    });
  });

  describe('getMember', () => {
    let spyOnServiceGet;
    let spyOnServiceGetByOrg;
    beforeEach(() => {
      spyOnServiceGet = jest.spyOn(service, 'get');
      spyOnServiceGetByOrg = jest.spyOn(service, 'getByOrg');
    });

    afterEach(() => {
      spyOnServiceGet.mockReset();
      spyOnServiceGetByOrg.mockReset();
    });

    it('should get a member for a given id', async () => {
      const member = mockGenerateMember();
      spyOnServiceGet.mockImplementationOnce(async () => member);
      const result = await resolver.getMember(member.id);
      expect(result).toEqual(member);
    });

    it('should throw exception on a non valid member', async () => {
      spyOnServiceGet.mockImplementationOnce(async () => {
        throw Error(Errors.get(ErrorType.memberNotFound));
      });
      await expect(resolver.getMember(generateId())).rejects.toThrow(
        Errors.get(ErrorType.memberNotFound),
      );
    });

    it('should throw exception on a non valid member', async () => {
      spyOnServiceGet.mockImplementationOnce(async () => {
        throw Error(Errors.get(ErrorType.memberNotFound));
      });
      await expect(resolver.getMember('not-valid')).rejects.toThrow(
        Errors.get(ErrorType.memberNotFound),
      );
    });

    it('should return org zip code if member does not have one', async () => {
      const member = mockGenerateMember();
      delete member.zipCode;
      spyOnServiceGet.mockResolvedValue(member);
      const result = await resolver.getMember(member.id);
      expect(result.zipCode).toEqual(member.org.zipCode);
    });

    it('should calculate utcDelta if zipCode exists', async () => {
      const member = mockGenerateMember();
      spyOnServiceGet.mockResolvedValue(member);
      const result = await resolver.getMember(member.id);
      expect(result.utcDelta).toBeLessThan(0);
    });
  });

  describe('getMembers', () => {
    let spyOnServiceGetByOrg;
    beforeEach(() => {
      spyOnServiceGetByOrg = jest.spyOn(service, 'getByOrg');
    });

    afterEach(() => {
      spyOnServiceGetByOrg.mockReset();
    });

    it('should get members for a given orgId', async () => {
      const member = mockGenerateMember();
      spyOnServiceGetByOrg.mockImplementationOnce(async () => [member]);

      const result = await resolver.getMembers(member.org.id);

      expect(spyOnServiceGetByOrg).toBeCalledTimes(1);
      expect(spyOnServiceGetByOrg).toBeCalledWith(member.org.id);
      expect(result).toEqual([member]);
    });

    it('should fetch all members without filtering orgId', async () => {
      const members = [mockGenerateMember(), mockGenerateMember()];
      spyOnServiceGetByOrg.mockImplementationOnce(async () => members);

      const result = await resolver.getMembers();

      expect(spyOnServiceGetByOrg).toBeCalledTimes(1);
      expect(spyOnServiceGetByOrg).toBeCalledWith(undefined);
      expect(result).toEqual(members);
    });
  });

  describe('getMembersAppointments', () => {
    let spyOnServiceGet;
    beforeEach(() => {
      spyOnServiceGet = jest.spyOn(service, 'getMembersAppointments');
    });

    afterEach(() => {
      spyOnServiceGet.mockReset();
    });

    it('should get appointments by a given orgId', async () => {
      const appointmentComposes = [generateAppointmentComposeParams()];
      spyOnServiceGet.mockImplementationOnce(async () => appointmentComposes);

      const orgId = generateId();
      const result = await resolver.getMembersAppointments(orgId);

      expect(spyOnServiceGet).toBeCalledTimes(1);
      expect(spyOnServiceGet).toBeCalledWith(orgId);
      expect(result).toEqual(appointmentComposes);
    });

    it('should fetch all appointments without filtering orgId', async () => {
      const appointmentComposes = [
        generateAppointmentComposeParams(),
        generateAppointmentComposeParams(),
      ];
      spyOnServiceGet.mockImplementationOnce(async () => appointmentComposes);

      const result = await resolver.getMembersAppointments();

      expect(spyOnServiceGet).toBeCalledTimes(1);
      expect(spyOnServiceGet).toBeCalledWith(undefined);
      expect(result).toEqual(appointmentComposes);
    });
  });

  describe('deleteMember', () => {
    let spyOnServiceDeleteMember;
    let spyOnOneSignalUnregister;
    let spyOnCognitoServiceDeleteMember;
    let spyOnStorageServiceDeleteMember;
    let spyOnDeleteSchedules;
    let spyOnNotifyDeletedMemberConfig;

    beforeEach(() => {
      spyOnServiceDeleteMember = jest.spyOn(service, 'deleteMember');
      spyOnOneSignalUnregister = jest.spyOn(oneSignal, 'unregister');
      spyOnCognitoServiceDeleteMember = jest.spyOn(cognitoService, 'deleteMember');
      spyOnStorageServiceDeleteMember = jest.spyOn(storage, 'deleteMember');
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      spyOnNotifyDeletedMemberConfig = jest.spyOn(resolver, 'notifyDeletedMemberConfig');
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      spyOnDeleteSchedules = jest.spyOn(resolver, 'deleteSchedules');
    });

    afterEach(() => {
      spyOnServiceDeleteMember.mockReset();
      spyOnCognitoServiceDeleteMember.mockReset();
      spyOnOneSignalUnregister.mockReset();
      spyOnStorageServiceDeleteMember.mockReset();
      spyOnEventEmitter.mockReset();
      spyOnDeleteSchedules.mockReset();
      spyOnNotifyDeletedMemberConfig.mockReset();
    });

    test.each`
      deviceId | hard
      ${true}  | ${false}
      ${true}  | ${true}
      ${false} | ${true}
      ${false} | ${false}
    `(`should delete a member with deviceId: $deviceId, hard: $hard`, async (params) => {
      const member = mockGenerateMember();
      if (!params.devideId) {
        delete member.deviceId;
      }
      const memberConfig = generateMemberConfig({ memberId: generateObjectId(member.id) });
      spyOnServiceDeleteMember.mockImplementationOnce(async () => ({ member, memberConfig }));
      const deleteMemberParams = generateDeleteMemberParams({
        id: member.id,
        hard: params.hard,
      });
      const userId = generateId();
      spyOnEventEmitter.mockReset();
      const result = await resolver.deleteMember(userId, deleteMemberParams);
      await delay(500);

      expect(result).toBeTruthy();
      expect(spyOnOneSignalUnregister).toBeCalledWith(memberConfig);
      if (member.deviceId) {
        expect(spyOnCognitoServiceDeleteMember).toBeCalledWith(member.deviceId);
      } else {
        expect(spyOnCognitoServiceDeleteMember).not.toHaveBeenCalled();
      }
      const eventParams: IEventDeleteMember = {
        memberId: member.id,
        deletedBy: userId,
        hard: params.hard,
      };
      expect(spyOnDeleteSchedules).toBeCalledWith(eventParams);
      expect(spyOnServiceDeleteMember).toBeCalledWith(deleteMemberParams, userId);
      expect(spyOnNotifyDeletedMemberConfig).toBeCalledWith(member.id);
      expect(spyOnEventEmitter).toHaveBeenCalledWith(EventType.onDeletedMember, eventParams);
      if (params.hard) {
        expect(spyOnStorageServiceDeleteMember).toBeCalledWith(member.id);
      }
    });
  });

  describe('getMemberUploadDischargeDocumentsLinks', () => {
    let spyOnServiceGet;
    let spyOnStorage;
    beforeEach(() => {
      spyOnServiceGet = jest.spyOn(service, 'get');
      spyOnStorage = jest.spyOn(storage, 'getUploadUrl');
    });

    afterEach(() => {
      spyOnServiceGet.mockReset();
      spyOnStorage.mockReset();
    });

    it('should get a member upload discharge documents links for a given context', async () => {
      const member = mockGenerateMember();
      spyOnServiceGet.mockImplementationOnce(async () => member);
      spyOnStorage.mockImplementation(async () => 'https://aws-bucket-path/extras');

      await resolver.getMemberUploadDischargeDocumentsLinks(member.id);

      checkDocumentsCall(member, spyOnServiceGet, spyOnStorage);
    });

    it('should throw exception on a non valid member', async () => {
      spyOnServiceGet.mockImplementationOnce(async () => {
        throw Error(Errors.get(ErrorType.memberNotFound));
      });

      await expect(resolver.getMemberUploadDischargeDocumentsLinks(generateId())).rejects.toThrow(
        Errors.get(ErrorType.memberNotFound),
      );
    });
  });

  const checkDocumentsCall = (member: Member, spyOnServiceGet, spyOnStorage) => {
    const prefix = `${member.firstName}_${member.lastName}`;
    const storageType = StorageType.documents;

    expect(spyOnServiceGet).toBeCalledTimes(1);
    expect(spyOnServiceGet).toBeCalledWith(member.id);
    expect(spyOnStorage).toBeCalledTimes(2);
    expect(spyOnStorage).toHaveBeenNthCalledWith(1, {
      storageType,
      memberId: member.id,
      id: `${prefix}_Summary.pdf`,
    });
    expect(spyOnStorage).toHaveBeenNthCalledWith(2, {
      storageType,
      memberId: member.id,
      id: `${prefix}_Instructions.pdf`,
    });
  };

  describe('getMemberDownloadDischargeDocumentsLinks', () => {
    let spyOnServiceGet;
    let spyOnStorage;
    beforeEach(() => {
      spyOnServiceGet = jest.spyOn(service, 'get');
      spyOnStorage = jest.spyOn(storage, 'getDownloadUrl');
    });

    afterEach(() => {
      spyOnServiceGet.mockReset();
      spyOnStorage.mockReset();
    });

    it('should get a member download discharge documents links for a given memberId', async () => {
      const member = mockGenerateMember();
      spyOnServiceGet.mockImplementationOnce(async () => member);
      spyOnStorage.mockImplementation(async () => 'https://aws-bucket-path/extras');
      await resolver.getMemberDownloadDischargeDocumentsLinks(member.id);

      checkDocumentsCall(member, spyOnServiceGet, spyOnStorage);
    });

    it('should throw exception on a non valid member', async () => {
      spyOnServiceGet.mockImplementationOnce(async () => {
        throw Error(Errors.get(ErrorType.memberNotFound));
      });

      await expect(resolver.getMemberDownloadDischargeDocumentsLinks(generateId())).rejects.toThrow(
        Errors.get(ErrorType.memberNotFound),
      );
    });
  });

  describe('getMemberUploadRecordingLink', () => {
    let spyOnServiceGet;
    let spyOnStorageUpload;
    let spyOnStorageDownload;

    beforeEach(() => {
      spyOnServiceGet = jest.spyOn(service, 'get');
      spyOnStorageUpload = jest.spyOn(storage, 'getUploadUrl');
      spyOnStorageDownload = jest.spyOn(storage, 'getDownloadUrl');
    });

    afterEach(() => {
      spyOnServiceGet.mockReset();
      spyOnStorageUpload.mockReset();
      spyOnStorageDownload.mockReset();
    });

    it('should get a member upload recording link', async () => {
      const member = mockGenerateMember();
      spyOnServiceGet.mockImplementationOnce(async () => member);
      spyOnStorageUpload.mockImplementation(async () => 'https://aws-bucket-path/extras');

      const id = generateId();
      await resolver.getMemberUploadRecordingLink({ id, memberId: member.id });

      expect(spyOnServiceGet).toBeCalledTimes(1);
      expect(spyOnServiceGet).toBeCalledWith(member.id);
      expect(spyOnStorageUpload).toBeCalledWith({
        storageType: StorageType.recordings,
        memberId: member.id,
        id,
      });
    });

    it('should throw exception on a non valid member', async () => {
      spyOnServiceGet.mockImplementationOnce(async () => {
        throw Error(Errors.get(ErrorType.memberNotFound));
      });

      await expect(
        resolver.getMemberUploadRecordingLink({ id: generateId(), memberId: generateId() }),
      ).rejects.toThrow(Errors.get(ErrorType.memberNotFound));
    });
  });

  describe('getMemberMultipartUploadRecordingLink', () => {
    let spyOnServiceGet;
    let spyOnStorageUpload;

    beforeEach(() => {
      spyOnServiceGet = jest.spyOn(service, 'get');
      spyOnStorageUpload = jest.spyOn(storage, 'getMultipartUploadUrl');
    });

    afterEach(() => {
      spyOnServiceGet.mockReset();
      spyOnStorageUpload.mockReset();
    });

    it('should get a member multipart upload recording link', async () => {
      const member = mockGenerateMember();
      spyOnServiceGet.mockImplementationOnce(async () => member);
      spyOnStorageUpload.mockImplementation(async () => 'https://aws-bucket-path/extras');

      const id = generateId();
      await resolver.getMemberMultipartUploadRecordingLink({
        id,
        memberId: member.id,
        partNumber: 0,
        uploadId: 'SOME_ID',
      });

      expect(spyOnServiceGet).toBeCalledTimes(1);
      expect(spyOnServiceGet).toBeCalledWith(member.id);
      expect(spyOnStorageUpload).toBeCalledWith({
        storageType: StorageType.recordings,
        memberId: member.id,
        partNumber: 0,
        id,
        uploadId: 'SOME_ID',
      });
    });

    it('should throw exception on a non valid member', async () => {
      spyOnServiceGet.mockImplementationOnce(async () => {
        throw Error(Errors.get(ErrorType.memberNotFound));
      });

      await expect(
        resolver.getMemberMultipartUploadRecordingLink({
          id: generateId(),
          memberId: generateId(),
          partNumber: 0,
        }),
      ).rejects.toThrow(Errors.get(ErrorType.memberNotFound));
    });
  });

  describe('completeMultipartUpload', () => {
    let spyOnServiceGet;
    let spyOnStorageComplete;

    beforeEach(() => {
      spyOnServiceGet = jest.spyOn(service, 'get');
      spyOnStorageComplete = jest.spyOn(storage, 'completeMultipartUpload');
    });

    afterEach(() => {
      spyOnServiceGet.mockReset();
      spyOnStorageComplete.mockReset();
    });

    it('should get a member multipart upload recording link', async () => {
      const member = mockGenerateMember();
      spyOnServiceGet.mockImplementationOnce(async () => member);
      spyOnStorageComplete.mockImplementation(async () => true);

      const id = generateId();
      await resolver.completeMultipartUpload({
        id,
        memberId: member.id,
        uploadId: 'SOME_ID',
      });

      expect(spyOnServiceGet).toBeCalledTimes(1);
      expect(spyOnServiceGet).toBeCalledWith(member.id);
      expect(spyOnStorageComplete).toBeCalledWith({
        storageType: StorageType.recordings,
        memberId: member.id,
        id,
        uploadId: 'SOME_ID',
      });
    });

    it('should throw exception on a non valid member', async () => {
      spyOnServiceGet.mockImplementationOnce(async () => {
        throw Error(Errors.get(ErrorType.memberNotFound));
      });

      await expect(
        resolver.completeMultipartUpload({
          id: generateId(),
          memberId: generateId(),
          uploadId: 'SOME_ID',
        }),
      ).rejects.toThrow(Errors.get(ErrorType.memberNotFound));
    });
  });

  describe('getMemberDownloadRecordingLink', () => {
    let spyOnServiceGet;
    let spyOnStorage;

    beforeEach(() => {
      spyOnServiceGet = jest.spyOn(service, 'get');
      spyOnStorage = jest.spyOn(storage, 'getDownloadUrl');
    });

    afterEach(() => {
      spyOnServiceGet.mockReset();
      spyOnStorage.mockReset();
    });

    it('should get a member upload recording link', async () => {
      const member = mockGenerateMember();
      spyOnServiceGet.mockImplementationOnce(async () => member);
      spyOnStorage.mockImplementation(async () => 'https://aws-bucket-path/extras');

      const id = generateId();
      await resolver.getMemberDownloadRecordingLink({ id, memberId: member.id });

      expect(spyOnServiceGet).toBeCalledTimes(1);
      expect(spyOnServiceGet).toBeCalledWith(member.id);
      expect(spyOnStorage).toBeCalledWith({
        storageType: StorageType.recordings,
        memberId: member.id,
        id,
      });
    });

    it('should throw exception on a non valid member', async () => {
      spyOnServiceGet.mockImplementationOnce(async () => {
        throw Error(Errors.get(ErrorType.memberNotFound));
      });

      await expect(
        resolver.getMemberDownloadRecordingLink({ id: generateId(), memberId: generateId() }),
      ).rejects.toThrow(Errors.get(ErrorType.memberNotFound));
    });
  });

  describe('createGoal', () => {
    let spyOnServiceInsertGoal;
    beforeEach(() => {
      spyOnServiceInsertGoal = jest.spyOn(service, 'insertGoal');
    });

    afterEach(() => {
      spyOnServiceInsertGoal.mockReset();
    });

    it('should create a goal', async () => {
      spyOnServiceInsertGoal.mockImplementationOnce(async () => ({
        id: generateId(),
      }));

      const params = generateCreateTaskParams();
      await resolver.createGoal(params);

      expect(spyOnServiceInsertGoal).toBeCalledTimes(1);
      expect(spyOnServiceInsertGoal).toBeCalledWith({
        createTaskParams: params,
        status: TaskStatus.pending,
      });
    });
  });

  describe('updateGoalStatus', () => {
    let spyOnServiceUpdateGoalStatus;
    beforeEach(() => {
      spyOnServiceUpdateGoalStatus = jest.spyOn(service, 'updateGoalStatus');
    });

    afterEach(() => {
      spyOnServiceUpdateGoalStatus.mockReset();
    });

    it('should create a goal', async () => {
      spyOnServiceUpdateGoalStatus.mockImplementationOnce(async () => undefined);

      const updateGoalStatus = { id: generateId(), status: TaskStatus.reached };
      await resolver.updateGoalStatus(updateGoalStatus);

      expect(spyOnServiceUpdateGoalStatus).toBeCalledTimes(1);
      expect(spyOnServiceUpdateGoalStatus).toBeCalledWith(updateGoalStatus);
    });
  });

  describe('createActionItem', () => {
    let spyOnServiceInsertActionItem;
    beforeEach(() => {
      spyOnServiceInsertActionItem = jest.spyOn(service, 'insertActionItem');
    });

    afterEach(() => {
      spyOnServiceInsertActionItem.mockReset();
    });

    it('should create an action item', async () => {
      spyOnServiceInsertActionItem.mockImplementationOnce(async () => ({
        id: generateId(),
      }));

      const params = generateCreateTaskParams();
      await resolver.createActionItem(params);

      expect(spyOnServiceInsertActionItem).toBeCalledTimes(1);
      expect(spyOnServiceInsertActionItem).toBeCalledWith({
        createTaskParams: params,
        status: TaskStatus.pending,
      });
    });
  });

  describe('updateActionItemStatus', () => {
    let spyOnServiceUpdateActionItemStatus;
    beforeEach(() => {
      spyOnServiceUpdateActionItemStatus = jest.spyOn(service, 'updateActionItemStatus');
    });

    afterEach(() => {
      spyOnServiceUpdateActionItemStatus.mockReset();
    });

    it('should create an action item', async () => {
      spyOnServiceUpdateActionItemStatus.mockImplementationOnce(async () => mockGenerateMember());

      const updateActionItemStatus = generateUpdateTaskStatusParams();
      await resolver.updateActionItemStatus(updateActionItemStatus);

      expect(spyOnServiceUpdateActionItemStatus).toBeCalledTimes(1);
      expect(spyOnServiceUpdateActionItemStatus).toBeCalledWith(updateActionItemStatus);
    });
  });

  describe('setGeneralNotes', () => {
    let spyOnServiceSetGeneralNotes;
    beforeEach(() => {
      spyOnServiceSetGeneralNotes = jest.spyOn(service, 'setGeneralNotes');
    });

    afterEach(() => {
      spyOnServiceSetGeneralNotes.mockReset();
    });

    it('should set general notes', async () => {
      spyOnServiceSetGeneralNotes.mockImplementationOnce(async () => undefined);

      const params = generateSetGeneralNotesParams();
      await resolver.setGeneralNotes(params);

      expect(spyOnServiceSetGeneralNotes).toBeCalledTimes(1);
      expect(spyOnServiceSetGeneralNotes).toBeCalledWith(params);
    });
  });

  describe('caregiver', () => {
    let spyOnAddCaregiverServiceMethod;
    let spyOnUpdateCaregiverServiceMethod;
    let spyOnGetCaregiversByMemberIdServiceMethod;
    let spyOnDeleteCaregiverServiceMethod;
    let spyOnGetCaregiverServiceMethod;

    beforeEach(() => {
      spyOnAddCaregiverServiceMethod = jest.spyOn(service, 'addCaregiver');
      spyOnUpdateCaregiverServiceMethod = jest.spyOn(service, 'updateCaregiver');
      spyOnGetCaregiversByMemberIdServiceMethod = jest.spyOn(service, 'getCaregiversByMemberId');
      spyOnDeleteCaregiverServiceMethod = jest.spyOn(service, 'deleteCaregiver');
      spyOnGetCaregiverServiceMethod = jest.spyOn(service, 'getCaregiver');
    });
    afterEach(() => {
      spyOnAddCaregiverServiceMethod.mockReset();
      spyOnUpdateCaregiverServiceMethod.mockReset();
      spyOnGetCaregiversByMemberIdServiceMethod.mockReset();
      spyOnDeleteCaregiverServiceMethod.mockReset();
      spyOnGetCaregiverServiceMethod.mockReset();
    });

    it('should add a caregiver', async () => {
      const memberId = generateId();
      const addCaregiverParams = generateAddCaregiverParams({ memberId });
      await resolver.addCaregiver(memberId, addCaregiverParams);
      expect(spyOnAddCaregiverServiceMethod).toBeCalledTimes(1);
      expect(spyOnAddCaregiverServiceMethod).toBeCalledWith({
        ...addCaregiverParams,
        createdBy: memberId,
      });
    });

    it('should update a caregiver with the inferred memberId', async () => {
      const memberId = generateId();
      const updateCaregiverParams = generateUpdateCaregiverParams({ memberId });
      await resolver.updateCaregiver(updateCaregiverParams);
      expect(spyOnUpdateCaregiverServiceMethod).toBeCalledTimes(1);
      expect(spyOnUpdateCaregiverServiceMethod).toBeCalledWith(updateCaregiverParams);
    });

    it('should get all caregiver for a member', async () => {
      const memberId = generateId();

      await resolver.getCaregivers(memberId);
      expect(spyOnGetCaregiversByMemberIdServiceMethod).toBeCalledTimes(1);
      expect(spyOnGetCaregiversByMemberIdServiceMethod).toBeCalledWith(memberId);
    });

    it('should delete a caregiver', async () => {
      const caregiverId = generateId();
      const memberId = generateId();

      spyOnGetCaregiverServiceMethod.mockImplementationOnce(async () => {
        return { memberId };
      });
      await resolver.deleteCaregiver(caregiverId);

      expect(spyOnDeleteCaregiverServiceMethod).toBeCalledTimes(1);
      expect(spyOnDeleteCaregiverServiceMethod).toBeCalledWith(caregiverId);
    });
  });

  describe('journal', () => {
    let spyOnServiceCreateJournal;
    let spyOnServiceUpdateJournal;
    let spyOnServiceGetJournal;
    let spyOnServiceGetJournals;
    let spyOnServiceDeleteJournal;
    let spyOnStorageGetDownloadUrl;
    let spyOnStorageGetUploadUrl;
    let spyOnStorageDeleteJournalImages;
    let spyOnStorageDeleteJournalAudio;
    let spyOnCommunicationServiceGet;
    let spyOnServiceGetMember;
    let spyOnServiceGetMemberConfig;
    let spyOnUserServiceGetUser;
    let spyOnCreateDispatch;

    const generateMockJournalParams = ({
      id = generateId(),
      memberId = new Types.ObjectId(generateId()),
      text = faker.lorem.sentence(),
      published = false,
      updatedAt = new Date(),
      imageFormat = ImageFormat.png,
      audioFormat = AudioFormat.mp3,
    }: Partial<Journal> = {}): Journal => {
      return {
        id,
        memberId,
        text,
        published,
        updatedAt,
        imageFormat,
        audioFormat,
      };
    };

    beforeEach(() => {
      spyOnServiceCreateJournal = jest.spyOn(service, 'createJournal');
      spyOnServiceUpdateJournal = jest.spyOn(service, 'updateJournal');
      spyOnServiceGetJournal = jest.spyOn(service, 'getJournal');
      spyOnServiceGetJournals = jest.spyOn(service, 'getJournals');
      spyOnServiceDeleteJournal = jest.spyOn(service, 'deleteJournal');
      spyOnStorageGetDownloadUrl = jest.spyOn(storage, 'getDownloadUrl');
      spyOnStorageGetUploadUrl = jest.spyOn(storage, 'getUploadUrl');
      spyOnStorageDeleteJournalImages = jest.spyOn(storage, 'deleteJournalImages');
      spyOnStorageDeleteJournalAudio = jest.spyOn(storage, 'deleteJournalAudio');
      spyOnCommunicationServiceGet = jest.spyOn(communicationService, 'get');
      spyOnServiceGetMember = jest.spyOn(service, 'get');
      spyOnServiceGetMemberConfig = jest.spyOn(service, 'getMemberConfig');
      spyOnUserServiceGetUser = jest.spyOn(userService, 'get');
      spyOnCreateDispatch = jest.spyOn(resolver, 'notifyCreateDispatch');
    });

    afterEach(() => {
      spyOnServiceCreateJournal.mockReset();
      spyOnServiceUpdateJournal.mockReset();
      spyOnServiceGetJournal.mockReset();
      spyOnServiceGetJournals.mockReset();
      spyOnServiceDeleteJournal.mockReset();
      spyOnStorageGetDownloadUrl.mockReset();
      spyOnStorageGetUploadUrl.mockReset();
      spyOnStorageDeleteJournalImages.mockReset();
      spyOnStorageDeleteJournalAudio.mockReset();
      spyOnCommunicationServiceGet.mockReset();
      spyOnServiceGetMember.mockReset();
      spyOnServiceGetMemberConfig.mockReset();
      spyOnUserServiceGetUser.mockReset();
      spyOnCreateDispatch.mockReset();
    });

    it('should create journal', async () => {
      const id = generateId();
      const memberId = generateId();
      spyOnServiceCreateJournal.mockImplementationOnce(async () => id);
      const result = await resolver.createJournal([MemberRole.member], memberId);

      expect(spyOnServiceCreateJournal).toBeCalledTimes(1);
      expect(spyOnServiceCreateJournal).toBeCalledWith(memberId);
      expect(result).toEqual(id);
    });

    test.each([UserRole.coach, UserRole.nurse, UserRole.admin])(
      'should throw an error on create journal if role = %p',
      async (role) => {
        await expect(resolver.createJournal([role], generateId())).rejects.toThrow(
          Error(Errors.get(ErrorType.memberAllowedOnly)),
        );
      },
    );

    it('should update journal', async () => {
      const params = generateUpdateJournalTextParams();
      const memberId = generateId();
      const journal = generateMockJournalParams({
        ...params,
        memberId: new Types.ObjectId(memberId),
      });
      const url = generateUniqueUrl();
      spyOnServiceUpdateJournal.mockImplementationOnce(async () => journal);
      spyOnStorageGetDownloadUrl.mockImplementation(async () => url);

      const result = await resolver.updateJournalText([MemberRole.member], memberId, params);

      expect(spyOnServiceUpdateJournal).toBeCalledTimes(1);

      expect(spyOnServiceUpdateJournal).toBeCalledWith({ ...params, memberId, published: false });
      expect(spyOnStorageGetDownloadUrl).toBeCalledTimes(3);
      expect(spyOnStorageGetDownloadUrl).toHaveBeenNthCalledWith(1, {
        storageType: StorageType.journals,
        memberId: journal.memberId.toString(),
        id: `${journal.id}${ImageType.NormalImage}.${journal.imageFormat}`,
      });
      expect(spyOnStorageGetDownloadUrl).toHaveBeenNthCalledWith(2, {
        storageType: StorageType.journals,
        memberId: journal.memberId.toString(),
        id: `${journal.id}${ImageType.SmallImage}.${journal.imageFormat}`,
      });
      expect(spyOnStorageGetDownloadUrl).toHaveBeenNthCalledWith(3, {
        storageType: StorageType.journals,
        memberId: journal.memberId.toString(),
        id: `${journal.id}${AudioType}.${journal.audioFormat}`,
      });
      expect(result).toEqual(journal);
    });

    test.each([UserRole.coach, UserRole.nurse, UserRole.admin])(
      'should throw an error on update journal if role = %p',
      async (role) => {
        await expect(
          resolver.updateJournalText([role], generateId(), generateUpdateJournalTextParams()),
        ).rejects.toThrow(Error(Errors.get(ErrorType.memberAllowedOnly)));
      },
    );

    it('should get journal', async () => {
      const memberId = generateId();
      const journal = generateMockJournalParams({ memberId: new Types.ObjectId(memberId) });
      const url = generateUniqueUrl();
      spyOnServiceGetJournal.mockImplementationOnce(async () => journal);
      spyOnStorageGetDownloadUrl.mockImplementation(async () => url);

      const result = await resolver.getJournal([MemberRole.member], memberId, journal.id);

      expect(spyOnServiceGetJournal).toBeCalledTimes(1);
      expect(spyOnServiceGetJournal).toBeCalledWith(journal.id, memberId);
      expect(spyOnStorageGetDownloadUrl).toBeCalledTimes(3);
      expect(spyOnStorageGetDownloadUrl).toHaveBeenNthCalledWith(1, {
        storageType: StorageType.journals,
        memberId: journal.memberId.toString(),
        id: `${journal.id}${ImageType.NormalImage}.${journal.imageFormat}`,
      });
      expect(spyOnStorageGetDownloadUrl).toHaveBeenNthCalledWith(2, {
        storageType: StorageType.journals,
        memberId: journal.memberId.toString(),
        id: `${journal.id}${ImageType.SmallImage}.${journal.imageFormat}`,
      });
      expect(spyOnStorageGetDownloadUrl).toHaveBeenNthCalledWith(3, {
        storageType: StorageType.journals,
        memberId: journal.memberId.toString(),
        id: `${journal.id}${AudioType}.${journal.audioFormat}`,
      });
      expect(result).toEqual(journal);
    });

    // eslint-disable-next-line max-len
    it(`should get journal without image and audio download link if imageFormat and audioFormat doesn't exists`, async () => {
      const memberId = generateId();
      const journal = generateMockJournalParams({ memberId: new Types.ObjectId(memberId) });
      delete journal.imageFormat;
      delete journal.audioFormat;
      const url = generateUniqueUrl();
      spyOnServiceGetJournal.mockImplementationOnce(async () => journal);
      spyOnStorageGetDownloadUrl.mockImplementation(async () => url);

      const result = await resolver.getJournal([MemberRole.member], memberId, journal.id);

      expect(spyOnServiceGetJournal).toBeCalledTimes(1);
      expect(spyOnServiceGetJournal).toBeCalledWith(journal.id, memberId);
      expect(spyOnStorageGetDownloadUrl).toBeCalledTimes(0);
      expect(result).toEqual(journal);
    });

    test.each([UserRole.coach, UserRole.nurse, UserRole.admin])(
      'should throw an error on get journal if role = %p',
      async (role) => {
        await expect(resolver.getJournal([role], generateId(), generateId())).rejects.toThrow(
          Error(Errors.get(ErrorType.memberAllowedOnly)),
        );
      },
    );

    it('should get Journals', async () => {
      const memberId = generateId();
      const journals = [
        generateMockJournalParams({
          memberId: new Types.ObjectId(memberId),
          imageFormat: ImageFormat.gif,
          audioFormat: AudioFormat.mp3,
        }),
        generateMockJournalParams({
          memberId: new Types.ObjectId(memberId),
          imageFormat: ImageFormat.png,
          audioFormat: AudioFormat.m4a,
        }),
      ];
      const url = generateUniqueUrl();
      spyOnServiceGetJournals.mockImplementationOnce(async () => journals);
      spyOnStorageGetDownloadUrl.mockImplementation(async () => url);
      const result = await resolver.getJournals([MemberRole.member], memberId);

      expect(spyOnServiceGetJournals).toBeCalledTimes(1);
      expect(spyOnServiceGetJournals).toBeCalledWith(memberId);
      expect(spyOnStorageGetDownloadUrl).toBeCalledTimes(6);
      expect(spyOnStorageGetDownloadUrl).toHaveBeenNthCalledWith(1, {
        storageType: StorageType.journals,
        memberId,
        id: `${journals[0].id}${ImageType.NormalImage}.${journals[0].imageFormat}`,
      });
      expect(spyOnStorageGetDownloadUrl).toHaveBeenNthCalledWith(2, {
        storageType: StorageType.journals,
        memberId,
        id: `${journals[0].id}${ImageType.SmallImage}.${journals[0].imageFormat}`,
      });
      expect(spyOnStorageGetDownloadUrl).toHaveBeenNthCalledWith(3, {
        storageType: StorageType.journals,
        memberId,
        id: `${journals[1].id}${ImageType.NormalImage}.${journals[1].imageFormat}`,
      });
      expect(spyOnStorageGetDownloadUrl).toHaveBeenNthCalledWith(4, {
        storageType: StorageType.journals,
        memberId,
        id: `${journals[1].id}${ImageType.SmallImage}.${journals[1].imageFormat}`,
      });
      expect(spyOnStorageGetDownloadUrl).toHaveBeenNthCalledWith(5, {
        storageType: StorageType.journals,
        memberId,
        id: `${journals[0].id}${AudioType}.${journals[0].audioFormat}`,
      });
      expect(spyOnStorageGetDownloadUrl).toHaveBeenNthCalledWith(6, {
        storageType: StorageType.journals,
        memberId,
        id: `${journals[1].id}${AudioType}.${journals[1].audioFormat}`,
      });
      expect(result).toEqual(journals);
    });

    test.each([UserRole.coach, UserRole.nurse, UserRole.admin])(
      'should throw an error on get Journals if role = %p',
      async (role) => {
        await expect(resolver.getJournals([role], generateId())).rejects.toThrow(
          Error(Errors.get(ErrorType.memberAllowedOnly)),
        );
      },
    );

    it('should delete Journal with image', async () => {
      const memberId = generateId();
      const journal = generateMockJournalParams({ memberId: new Types.ObjectId(memberId) });
      spyOnServiceDeleteJournal.mockImplementationOnce(async () => journal);
      spyOnStorageDeleteJournalImages.mockImplementationOnce(async () => true);

      const result = await resolver.deleteJournal([MemberRole.member], memberId, journal.id);

      expect(spyOnServiceDeleteJournal).toBeCalledTimes(1);
      expect(spyOnServiceDeleteJournal).toBeCalledWith(journal.id, memberId);
      expect(spyOnStorageDeleteJournalImages).toBeCalledWith(
        journal.id,
        journal.memberId.toString(),
        journal.imageFormat,
      );
      expect(result).toBeTruthy();
    });

    it('should delete Journal with no image', async () => {
      const memberId = generateId();
      const journal = generateMockJournalParams({ memberId: new Types.ObjectId(memberId) });
      delete journal.imageFormat;
      spyOnServiceDeleteJournal.mockImplementationOnce(async () => journal);
      spyOnStorageDeleteJournalImages.mockImplementationOnce(async () => true);

      const result = await resolver.deleteJournal([MemberRole.member], memberId, journal.id);

      expect(spyOnServiceDeleteJournal).toBeCalledTimes(1);
      expect(spyOnServiceDeleteJournal).toBeCalledWith(journal.id, memberId);
      expect(spyOnStorageDeleteJournalImages).toBeCalledTimes(0);
      expect(result).toBeTruthy();
    });

    test.each([UserRole.coach, UserRole.nurse, UserRole.admin])(
      'should throw an error on delete journal if role = %p',
      async (role) => {
        await expect(resolver.deleteJournal([role], generateId(), generateId())).rejects.toThrow(
          Error(Errors.get(ErrorType.memberAllowedOnly)),
        );
      },
    );

    it('should get member upload journal image link', async () => {
      const memberId = generateId();
      const journal = generateMockJournalParams({ memberId: new Types.ObjectId(memberId) });
      const url = generateUniqueUrl();
      spyOnServiceUpdateJournal.mockImplementationOnce(async () => journal);
      spyOnStorageGetUploadUrl.mockImplementation(async () => url);

      const params = generateGetMemberUploadJournalImageLinkParams({ id: journal.id });
      const result = await resolver.getMemberUploadJournalImageLink(
        [MemberRole.member],
        memberId,
        params,
      );

      expect(spyOnServiceUpdateJournal).toBeCalledTimes(1);
      expect(spyOnServiceUpdateJournal).toBeCalledWith({ ...params, memberId, published: false });

      expect(spyOnStorageGetUploadUrl).toBeCalledTimes(1);
      expect(spyOnStorageGetUploadUrl).toHaveBeenNthCalledWith(1, {
        storageType: StorageType.journals,
        memberId: journal.memberId.toString(),
        id: `${journal.id}${ImageType.NormalImage}.${params.imageFormat}`,
      });

      expect(result).toEqual({ normalImageLink: url });
    });

    test.each([UserRole.coach, UserRole.nurse, UserRole.admin])(
      'should throw an error on get member upload journal links if role = %p',
      async (role) => {
        await expect(
          resolver.getMemberUploadJournalImageLink(
            [role],
            generateId(),
            generateGetMemberUploadJournalImageLinkParams(),
          ),
        ).rejects.toThrow(Error(Errors.get(ErrorType.memberAllowedOnly)));
      },
    );

    it('should get member upload journal audio link', async () => {
      const memberId = generateId();
      const journal = generateMockJournalParams({ memberId: new Types.ObjectId(memberId) });
      const url = generateUniqueUrl();
      spyOnServiceUpdateJournal.mockImplementationOnce(async () => journal);
      spyOnStorageGetUploadUrl.mockImplementationOnce(async () => url);

      const params = generateGetMemberUploadJournalAudioLinkParams({ id: journal.id });
      const result = await resolver.getMemberUploadJournalAudioLink(
        [MemberRole.member],
        memberId,
        params,
      );

      expect(spyOnServiceUpdateJournal).toBeCalledTimes(1);
      expect(spyOnServiceUpdateJournal).toBeCalledWith({ ...params, memberId, published: false });

      expect(spyOnStorageGetUploadUrl).toBeCalledTimes(1);
      expect(spyOnStorageGetUploadUrl).toHaveBeenNthCalledWith(1, {
        storageType: StorageType.journals,
        memberId: journal.memberId.toString(),
        id: `${journal.id}${AudioType}.${journal.audioFormat}`,
      });

      expect(result).toEqual({ audioLink: url });
    });

    test.each([UserRole.coach, UserRole.nurse, UserRole.admin])(
      'should throw an error on get member upload journal links if role = %p',
      async (role) => {
        await expect(
          resolver.getMemberUploadJournalAudioLink(
            [role],
            generateId(),
            generateGetMemberUploadJournalAudioLinkParams(),
          ),
        ).rejects.toThrow(Error(Errors.get(ErrorType.memberAllowedOnly)));
      },
    );

    it('should delete Journal images', async () => {
      const memberId = generateId();
      const journal = generateMockJournalParams({ memberId: new Types.ObjectId(memberId) });
      spyOnServiceGetJournal.mockImplementationOnce(async () => journal);
      spyOnServiceUpdateJournal.mockImplementationOnce(async () => journal);
      spyOnStorageDeleteJournalImages.mockImplementationOnce(async () => true);

      const result = await resolver.deleteJournalImage([MemberRole.member], memberId, journal.id);

      expect(spyOnServiceUpdateJournal).toBeCalledTimes(1);
      expect(spyOnServiceUpdateJournal).toBeCalledWith({
        id: journal.id,
        imageFormat: null,
        memberId,
        published: false,
      });
      expect(spyOnStorageDeleteJournalImages).toBeCalledWith(
        journal.id,
        journal.memberId.toString(),
        journal.imageFormat,
      );
      expect(result).toEqual(true);
    });

    it('should throw an error on delete Journal images if no image', async () => {
      const memberId = generateId();
      const journal = generateMockJournalParams({ memberId: new Types.ObjectId(memberId) });
      delete journal.imageFormat;
      spyOnServiceGetJournal.mockImplementationOnce(async () => journal);
      spyOnServiceUpdateJournal.mockImplementationOnce(async () => journal);
      spyOnStorageDeleteJournalImages.mockImplementationOnce(async () => true);

      await expect(
        resolver.deleteJournalImage([MemberRole.member], generateId(), generateId()),
      ).rejects.toThrow(Error(Errors.get(ErrorType.memberJournalImageNotFound)));
    });

    test.each([UserRole.coach, UserRole.nurse, UserRole.admin])(
      'should throw an error on delete journal image if role = %p',
      async (role) => {
        await expect(
          resolver.deleteJournalImage([role], generateId(), generateId()),
        ).rejects.toThrow(Error(Errors.get(ErrorType.memberAllowedOnly)));
      },
    );

    it('should delete Journal audio', async () => {
      const memberId = generateId();
      const journal = generateMockJournalParams({ memberId: new Types.ObjectId(memberId) });
      spyOnServiceGetJournal.mockImplementationOnce(async () => journal);
      spyOnServiceUpdateJournal.mockImplementationOnce(async () => journal);
      spyOnStorageDeleteJournalAudio.mockImplementationOnce(async () => true);

      const result = await resolver.deleteJournalAudio([MemberRole.member], memberId, journal.id);

      expect(spyOnServiceUpdateJournal).toBeCalledTimes(1);
      expect(spyOnServiceUpdateJournal).toBeCalledWith({
        id: journal.id,
        audioFormat: null,
        memberId,
        published: false,
      });
      expect(spyOnStorageDeleteJournalAudio).toBeCalledWith(
        journal.id,
        journal.memberId.toString(),
        journal.audioFormat,
      );
      expect(result).toEqual(true);
    });

    it('should throw an error on delete Journal audio if no audio', async () => {
      const memberId = generateId();
      const journal = generateMockJournalParams({ memberId: new Types.ObjectId(memberId) });
      delete journal.audioFormat;
      spyOnServiceGetJournal.mockImplementationOnce(async () => journal);
      spyOnServiceUpdateJournal.mockImplementationOnce(async () => journal);
      spyOnStorageDeleteJournalAudio.mockImplementationOnce(async () => true);

      await expect(
        resolver.deleteJournalAudio([MemberRole.member], generateId(), generateId()),
      ).rejects.toThrow(Error(Errors.get(ErrorType.memberJournalAudioNotFound)));
    });

    test.each([UserRole.coach, UserRole.nurse, UserRole.admin])(
      'should throw an error on delete journal audio if role = %p',
      async (role) => {
        await expect(
          resolver.deleteJournalAudio([role], generateId(), generateId()),
        ).rejects.toThrow(Error(Errors.get(ErrorType.memberAllowedOnly)));
      },
    );

    it('should publish Journal', async () => {
      const member = mockGenerateMember();
      const memberConfig = mockGenerateMemberConfig();
      const user = mockGenerateUser();
      const memberId = generateId();
      const journal = generateMockJournalParams({ memberId: new Types.ObjectId(memberId) });
      const communication = generateCommunication();
      const journalImageDownloadLink = generateUniqueUrl();
      const journalAudioDownloadLink = generateUniqueUrl();
      spyOnServiceUpdateJournal.mockImplementationOnce(async () => journal);
      spyOnStorageDeleteJournalImages.mockImplementationOnce(async () => true);
      spyOnCommunicationServiceGet.mockImplementationOnce(async () => communication);
      spyOnStorageGetDownloadUrl.mockImplementationOnce(async () => journalImageDownloadLink);
      spyOnStorageGetDownloadUrl.mockImplementationOnce(async () => journalAudioDownloadLink);
      spyOnServiceGetMember.mockImplementation(async () => member);
      spyOnServiceGetMemberConfig.mockImplementationOnce(async () => memberConfig);
      spyOnUserServiceGetUser.mockImplementationOnce(async () => user);
      spyOnCreateDispatch.mockImplementationOnce(async () => undefined);

      await resolver.publishJournal([MemberRole.member], memberId, journal.id);

      expect(spyOnServiceUpdateJournal).toBeCalledTimes(1);
      expect(spyOnServiceUpdateJournal).toBeCalledWith({
        id: journal.id,
        memberId,
        published: true,
      });

      expect(spyOnServiceGetMember).toBeCalledTimes(1);
      expect(spyOnServiceGetMember).toBeCalledWith(memberId);
      expect(spyOnCommunicationServiceGet).toBeCalledWith({
        memberId,
        userId: member.primaryUserId.toString(),
      });
      expect(spyOnStorageGetDownloadUrl).toBeCalledWith({
        storageType: StorageType.journals,
        memberId,
        id: `${journal.id}${ImageType.NormalImage}.${journal.imageFormat}`,
      });
      expect(spyOnCreateDispatch).toBeCalled();
    });

    it('should publish Journal with no image', async () => {
      const member = mockGenerateMember();
      const memberConfig = mockGenerateMemberConfig();
      const user = mockGenerateUser();
      const memberId = generateId();
      const journal = generateMockJournalParams({
        memberId: new Types.ObjectId(memberId),
        imageFormat: null,
      });
      const communication = generateCommunication();
      const journalAudioDownloadLink = generateUniqueUrl();
      spyOnServiceUpdateJournal.mockImplementationOnce(async () => journal);
      spyOnStorageDeleteJournalImages.mockImplementationOnce(async () => true);
      spyOnCommunicationServiceGet.mockImplementationOnce(async () => communication);
      spyOnStorageGetDownloadUrl.mockImplementationOnce(async () => journalAudioDownloadLink);
      spyOnServiceGetJournal.mockImplementationOnce(async () => journal);
      spyOnServiceGetMember.mockImplementation(async () => member);
      spyOnServiceGetMemberConfig.mockImplementationOnce(async () => memberConfig);
      spyOnUserServiceGetUser.mockImplementationOnce(async () => user);
      spyOnCreateDispatch.mockImplementationOnce(async () => undefined);

      await resolver.publishJournal([MemberRole.member], memberId, journal.id);

      expect(spyOnStorageGetDownloadUrl).toReturnTimes(1);
      expect(spyOnCreateDispatch).toBeCalled();
    });

    it('should publish Journal with no audio', async () => {
      const member = mockGenerateMember();
      const memberConfig = mockGenerateMemberConfig();
      const user = mockGenerateUser();
      const memberId = generateId();
      const journal = generateMockJournalParams({
        memberId: new Types.ObjectId(memberId),
        audioFormat: null,
      });
      const communication = generateCommunication();
      const journalImageDownloadLink = generateUniqueUrl();
      spyOnServiceUpdateJournal.mockImplementationOnce(async () => journal);
      spyOnStorageDeleteJournalImages.mockImplementationOnce(async () => true);
      spyOnCommunicationServiceGet.mockImplementationOnce(async () => communication);
      spyOnStorageGetDownloadUrl.mockImplementationOnce(async () => journalImageDownloadLink);
      spyOnServiceGetJournal.mockImplementationOnce(async () => journal);
      spyOnServiceGetMember.mockImplementation(async () => member);
      spyOnServiceGetMemberConfig.mockImplementationOnce(async () => memberConfig);
      spyOnUserServiceGetUser.mockImplementationOnce(async () => user);
      spyOnCreateDispatch.mockImplementationOnce(async () => undefined);

      await resolver.publishJournal([MemberRole.member], memberId, journal.id);

      expect(spyOnStorageGetDownloadUrl).toReturnTimes(1);
      expect(spyOnCreateDispatch).toBeCalled();
    });

    it('should publish Journal with no audio and no image', async () => {
      const member = mockGenerateMember();
      const memberConfig = mockGenerateMemberConfig();
      const user = mockGenerateUser();
      const memberId = generateId();
      const journal = generateMockJournalParams({
        memberId: new Types.ObjectId(memberId),
        imageFormat: null,
        audioFormat: null,
      });
      const communication = generateCommunication();
      const url = generateUniqueUrl();
      spyOnServiceUpdateJournal.mockImplementationOnce(async () => journal);
      spyOnStorageDeleteJournalImages.mockImplementationOnce(async () => true);
      spyOnCommunicationServiceGet.mockImplementationOnce(async () => communication);
      spyOnStorageGetDownloadUrl.mockImplementation(async () => url);
      spyOnServiceGetJournal.mockImplementationOnce(async () => journal);
      spyOnServiceGetMember.mockImplementation(async () => member);
      spyOnServiceGetMemberConfig.mockImplementationOnce(async () => memberConfig);
      spyOnUserServiceGetUser.mockImplementationOnce(async () => user);
      spyOnCreateDispatch.mockImplementationOnce(async () => undefined);

      await resolver.publishJournal([MemberRole.member], memberId, journal.id);

      expect(spyOnStorageGetDownloadUrl).toReturnTimes(0);
      expect(spyOnCreateDispatch).toBeCalled();
    });

    test.each([UserRole.coach, UserRole.nurse, UserRole.admin])(
      'should throw an error on publish journal if role = %p',
      async (role) => {
        await expect(resolver.publishJournal([role], generateId(), generateId())).rejects.toThrow(
          Error(Errors.get(ErrorType.memberAllowedOnly)),
        );
      },
    );
  });

  describe('getMemberConfig', () => {
    let spyOnServiceGetMemberConfig;
    beforeEach(() => {
      spyOnServiceGetMemberConfig = jest.spyOn(service, 'getMemberConfig');
    });

    afterEach(() => {
      spyOnServiceGetMemberConfig.mockReset();
    });

    it('should call MemberConfig', async () => {
      const memberConfig = mockGenerateMemberConfig();
      spyOnServiceGetMemberConfig.mockImplementationOnce(async () => memberConfig);
      await resolver.getMemberConfig(memberConfig.memberId.toString());

      expect(spyOnServiceGetMemberConfig).toBeCalledTimes(1);
      expect(spyOnServiceGetMemberConfig).toBeCalledWith(memberConfig.memberId.toString());
    });
  });

  describe('updateMemberConfig', () => {
    let spyOnServiceUpdateConfig;

    beforeEach(() => {
      spyOnServiceUpdateConfig = jest.spyOn(service, 'updateMemberConfig');
    });

    afterEach(() => {
      spyOnServiceUpdateConfig.mockReset();
      spyOnEventEmitter.mockReset();
      spyOnEventEmitter.mockClear();
    });

    it('should update a member config', async () => {
      const memberConfig = mockGenerateMemberConfig();
      const memberId = generateId(memberConfig.memberId);
      const updateMemberConfigParams = generateUpdateMemberConfigParams({ memberId });
      spyOnServiceUpdateConfig.mockImplementationOnce(async () => memberConfig);
      delete updateMemberConfigParams.memberId;

      await resolver.updateMemberConfig([MemberRole.member], memberId, updateMemberConfigParams);

      expect(spyOnServiceUpdateConfig).toBeCalledTimes(1);
      expect(spyOnServiceUpdateConfig).toBeCalledWith({ ...updateMemberConfigParams, memberId });

      const eventParams: IEventNotifyQueue = {
        type: QueueType.notifications,
        message: JSON.stringify(generateUpdateClientSettings({ memberConfig })),
      };
      expect(spyOnEventEmitter).toBeCalledWith(EventType.notifyQueue, eventParams);
    });
  });

  describe('registerMemberForNotifications', () => {
    let spyOnOneSignalRegister;
    let spyOnServiceGetMember;
    let spyOnServiceGetMemberConfig;
    let spyOnServiceUpdateMemberConfig;
    let spyOnServiceUpdateMemberConfigRegisteredAt;

    beforeEach(() => {
      spyOnOneSignalRegister = jest.spyOn(oneSignal, 'register');
      spyOnServiceGetMember = jest.spyOn(service, 'get');
      spyOnServiceGetMemberConfig = jest.spyOn(service, 'getMemberConfig');
      spyOnServiceUpdateMemberConfig = jest.spyOn(service, 'updateMemberConfig');
      spyOnServiceUpdateMemberConfigRegisteredAt = jest.spyOn(
        service,
        'updateMemberConfigRegisteredAt',
      );
    });

    afterEach(() => {
      spyOnOneSignalRegister.mockReset();
      spyOnServiceGetMember.mockReset();
      spyOnServiceGetMemberConfig.mockReset();
      spyOnServiceUpdateMemberConfig.mockReset();
      spyOnServiceUpdateMemberConfigRegisteredAt.mockReset();
      spyOnEventEmitter.mockReset();
      spyOnEventEmitter.mockClear();
    });

    it('should not call notificationsService on platform=android', async () => {
      spyOnOneSignalRegister.mockImplementationOnce(async () => undefined);
      const currentMemberConfig = mockGenerateMemberConfig();
      delete currentMemberConfig.firstLoggedInAt;
      const member = mockGenerateMember();
      member.id = currentMemberConfig.memberId.toString();
      spyOnServiceGetMember.mockImplementationOnce(async () => member);
      spyOnServiceGetMemberConfig.mockImplementationOnce(async () => currentMemberConfig);

      const updateFields = {
        platform: Platform.android,
        isPushNotificationsEnabled: true,
      };
      const params: RegisterForNotificationParams = { ...updateFields };
      const memberConfig = generateMemberConfig({
        memberId: currentMemberConfig.memberId,
        ...updateFields,
      });
      spyOnServiceUpdateMemberConfig.mockImplementationOnce(async () => memberConfig);
      await resolver.registerMemberForNotifications([MemberRole.member], member.id, params);

      expect(spyOnOneSignalRegister).not.toBeCalled();
      expect(spyOnServiceGetMember).toBeCalledTimes(1);
      expect(spyOnServiceGetMember).toBeCalledWith(member.id);
      expect(spyOnServiceUpdateMemberConfig).toBeCalledTimes(1);
      expect(spyOnServiceUpdateMemberConfig).toBeCalledWith({
        memberId: member.id,
        platform: params.platform,
        isPushNotificationsEnabled: memberConfig.isPushNotificationsEnabled,
      });
      expect(spyOnServiceUpdateMemberConfigRegisteredAt).toBeCalledWith(memberConfig.memberId);
      const eventParams: IEventNotifyQueue = {
        type: QueueType.notifications,
        message: JSON.stringify(generateUpdateClientSettings({ memberConfig })),
      };
      expect(spyOnEventEmitter).toBeCalledWith(EventType.notifyQueue, eventParams);
    });

    it('should call notificationsService on platform=ios', async () => {
      const currentMemberConfig = mockGenerateMemberConfig();
      delete currentMemberConfig.firstLoggedInAt;
      const member = mockGenerateMember();
      member.id = currentMemberConfig.memberId.toString();
      spyOnServiceGetMemberConfig.mockImplementationOnce(async () => currentMemberConfig);
      spyOnServiceGetMember.mockImplementationOnce(async () => member);

      const updateFields = {
        platform: Platform.ios,
        isPushNotificationsEnabled: currentMemberConfig.isPushNotificationsEnabled,
        token: faker.lorem.word(),
      };
      const params: RegisterForNotificationParams = { ...updateFields };
      const memberConfig = generateMemberConfig({
        memberId: currentMemberConfig.memberId,
        ...updateFields,
      });
      spyOnServiceUpdateMemberConfig.mockImplementationOnce(async () => memberConfig);
      await resolver.registerMemberForNotifications([MemberRole.member], member.id, params);

      expect(spyOnOneSignalRegister).toBeCalledTimes(1);
      expect(spyOnOneSignalRegister).toBeCalledWith({
        token: params.token,
        externalUserId: currentMemberConfig.externalUserId,
      });
      expect(spyOnServiceUpdateMemberConfig).toBeCalledTimes(1);
      expect(spyOnServiceUpdateMemberConfig).toBeCalledWith({
        memberId: member.id,
        platform: params.platform,
        isPushNotificationsEnabled: memberConfig.isPushNotificationsEnabled,
      });

      const eventParams: IEventOnUpdatedMemberPlatform = {
        memberId: member.id,
        platform: params.platform,
        userId: member.primaryUserId.toString(),
      };
      const notify: IEventNotifyQueue = {
        type: QueueType.notifications,
        message: JSON.stringify(generateUpdateClientSettings({ memberConfig })),
      };
      expect(spyOnEventEmitter).toHaveBeenNthCalledWith(
        1,
        EventType.onUpdatedMemberPlatform,
        eventParams,
      );
      expect(spyOnEventEmitter).toHaveBeenNthCalledWith(2, EventType.notifyQueue, notify);
    });

    it('should not call updateMemberConfigRegisteredAt if firstLoggedInAt exists', async () => {
      const currentMemberConfig = mockGenerateMemberConfig();
      const member = mockGenerateMember();
      member.id = currentMemberConfig.memberId.toString();
      spyOnServiceGetMember.mockImplementationOnce(async () => member);
      spyOnServiceGetMemberConfig.mockImplementationOnce(async () => currentMemberConfig);

      const updateFields = {
        platform: Platform.android,
        isPushNotificationsEnabled: false,
      };
      const params: RegisterForNotificationParams = { ...updateFields };
      const memberConfig = generateMemberConfig({
        memberId: currentMemberConfig.memberId,
        ...updateFields,
      });
      spyOnServiceUpdateMemberConfig.mockImplementationOnce(async () => memberConfig);
      await resolver.registerMemberForNotifications([MemberRole.member], member.id, params);

      expect(spyOnServiceUpdateMemberConfigRegisteredAt).not.toBeCalled();

      const eventParams: IEventNotifyQueue = {
        type: QueueType.notifications,
        message: JSON.stringify(generateUpdateClientSettings({ memberConfig })),
      };
      expect(spyOnEventEmitter).toBeCalledWith(EventType.notifyQueue, eventParams);
    });

    /* eslint-disable-next-line max-len */
    it('should throw error for a non-member user attempting to registerMemberForNotifications', async () => {
      const memberConfig = mockGenerateMemberConfig();
      const member = mockGenerateMember();
      member.id = memberConfig.memberId.toString();
      spyOnServiceGetMember.mockImplementationOnce(async () => member);
      spyOnServiceGetMemberConfig.mockImplementationOnce(async () => memberConfig);

      const params: RegisterForNotificationParams = {
        platform: Platform.android,
        isPushNotificationsEnabled: true,
      };
      await expect(
        resolver.registerMemberForNotifications([UserRole.coach], member.id, params),
      ).rejects.toThrow(Errors.get(ErrorType.memberAllowedOnly));
    });
  });

  describe('updateRecording', () => {
    let spyOnServiceUpdate;
    beforeEach(() => {
      spyOnServiceUpdate = jest.spyOn(service, 'updateRecording');
    });

    afterEach(() => {
      spyOnServiceUpdate.mockReset();
    });

    it('should get a member upload discharge documents links for a given context', async () => {
      const memberId = generateId();
      spyOnServiceUpdate.mockResolvedValue(undefined);

      const recording = generateUpdateRecordingParams({ memberId });
      await resolver.updateRecording(recording, recording.userId);

      expect(spyOnServiceUpdate).toBeCalledTimes(1);
      expect(spyOnServiceUpdate).toBeCalledWith(recording, recording.userId);
    });
  });

  describe('getRecordings', () => {
    let spyOnServiceGet;
    beforeEach(() => {
      spyOnServiceGet = jest.spyOn(service, 'getRecordings');
    });

    afterEach(() => {
      spyOnServiceGet.mockReset();
    });

    it('should get a member upload discharge documents links for a given context', async () => {
      const memberId = generateId();
      await resolver.getRecordings(memberId);

      expect(spyOnServiceGet).toBeCalledTimes(1);
      expect(spyOnServiceGet).toBeCalledWith(memberId);
    });
  });

  describe('replaceUserForMember', () => {
    let spyOnServiceReplaceUserForMember;
    let spyOnUserServiceGet;
    let spyOnServiceGetMemberConfig;

    beforeEach(() => {
      spyOnUserServiceGet = jest.spyOn(userService, 'get');
      spyOnServiceReplaceUserForMember = jest.spyOn(service, 'updatePrimaryUser');
      spyOnServiceGetMemberConfig = jest.spyOn(service, 'getMemberConfig');
    });

    afterEach(() => {
      spyOnServiceReplaceUserForMember.mockReset();
      spyOnUserServiceGet.mockReset();
      spyOnEventEmitter.mockReset();
      spyOnServiceGetMemberConfig.mockReset();
    });

    it('should set new user for a given member', async () => {
      const member = mockGenerateMember();
      const user = mockGenerateUser();
      const memberConfig = mockGenerateMemberConfig();
      spyOnServiceGetMemberConfig.mockImplementationOnce(async () => memberConfig);
      spyOnUserServiceGet.mockImplementationOnce(async () => user);
      spyOnServiceReplaceUserForMember.mockImplementationOnce(async () => member);

      await resolver.replaceUserForMember({ memberId: member.id, userId: user.id });

      expect(spyOnUserServiceGet).toBeCalledWith(user.id);
      expect(spyOnServiceReplaceUserForMember).toBeCalledWith({
        memberId: member.id,
        userId: user.id,
      });
      expect(spyOnEventEmitter).toBeCalledWith(EventType.onReplacedUserForMember, {
        newUser: user,
        oldUserId: member.primaryUserId.toString(),
        member,
        platform: memberConfig.platform,
      });
    });

    it("should throw an exception when the new user doesn't exist", async () => {
      const memberId = generateId();
      const user = mockGenerateUser();
      spyOnUserServiceGet.mockImplementationOnce(async () => null);

      await expect(resolver.replaceUserForMember({ memberId, userId: user.id })).rejects.toThrow(
        Errors.get(ErrorType.userNotFound),
      );
    });

    test.each([ErrorType.memberNotFound, ErrorType.userIdOrEmailAlreadyExists])(
      `should raise an exception when the service raises exception: %p`,
      async (error) => {
        const memberId = generateId();
        const user = mockGenerateUser();
        spyOnUserServiceGet.mockImplementationOnce(async () => user);
        spyOnServiceReplaceUserForMember.mockImplementationOnce(async () => {
          throw new Error(Errors.get(error));
        });

        await expect(resolver.replaceUserForMember({ memberId, userId: user.id })).rejects.toThrow(
          Errors.get(error),
        );
        expect(spyOnEventEmitter).not.toHaveBeenCalled();
      },
    );
  });

  describe('notify', () => {
    let spyOnServiceGetMember;
    let spyOnServiceGetMemberConfig;
    let spyOnUserServiceGetUser;
    let spyOnCommunicationResolverGetCommunication;
    let spyOnCommunicationServiceGet;
    let spyOnCreateDispatch;

    beforeEach(() => {
      spyOnServiceGetMember = jest.spyOn(service, 'get');
      spyOnServiceGetMemberConfig = jest.spyOn(service, 'getMemberConfig');
      spyOnUserServiceGetUser = jest.spyOn(userService, 'get');
      spyOnCommunicationResolverGetCommunication = jest.spyOn(
        communicationResolver,
        'getCommunication',
      );
      spyOnCommunicationServiceGet = jest.spyOn(communicationService, 'get');
      spyOnCreateDispatch = jest.spyOn(resolver, 'notifyCreateDispatch');
    });

    afterEach(() => {
      spyOnServiceGetMember.mockReset();
      spyOnServiceGetMemberConfig.mockReset();
      spyOnUserServiceGetUser.mockReset();
      spyOnCommunicationResolverGetCommunication.mockReset();
      spyOnCommunicationServiceGet.mockReset();
      spyOnCreateDispatch.mockReset();
    });

    it('should catch notify exception on non existing user', async () => {
      const member = mockGenerateMember();
      const memberConfig = mockGenerateMemberConfig();
      spyOnServiceGetMember.mockImplementationOnce(async () => member);
      spyOnServiceGetMemberConfig.mockImplementationOnce(async () => memberConfig);
      spyOnUserServiceGetUser.mockImplementationOnce(async () => undefined);

      await expect(resolver.notify(generateNotifyParams())).rejects.toThrow(
        Errors.get(ErrorType.userNotFound),
      );
    });

    it('should catch notify exception on non existing member', async () => {
      const memberConfig = mockGenerateMemberConfig();
      const user = mockGenerateUser();
      spyOnServiceGetMember.mockImplementationOnce(async () => undefined);
      spyOnServiceGetMemberConfig.mockImplementationOnce(async () => memberConfig);
      spyOnUserServiceGetUser.mockImplementationOnce(async () => user);

      await expect(resolver.notify(generateNotifyParams())).rejects.toThrow(
        Errors.get(ErrorType.memberNotFound),
      );
    });

    test.each([NotificationType.call, NotificationType.video])(
      'should throw an error when a web member receives video or call notification',
      async (params) => {
        const member = mockGenerateMember();
        const memberConfig = mockGenerateMemberConfig();
        memberConfig.platform = Platform.web;
        const user = mockGenerateUser();
        spyOnServiceGetMember.mockImplementationOnce(async () => member);
        spyOnServiceGetMemberConfig.mockImplementationOnce(async () => memberConfig);
        spyOnUserServiceGetUser.mockImplementationOnce(async () => user);

        const notifyParams = generateNotifyParams({ type: params });

        await expect(resolver.notify(notifyParams)).rejects.toThrow(
          Errors.get(ErrorType.notificationMemberPlatformWeb),
        );
      },
    );

    test.each([NotificationType.call, NotificationType.video])(
      // eslint-disable-next-line max-len
      'should throw an error when member with isPushNotificationsEnabled=false receives video or call notification',
      async (params) => {
        const member = mockGenerateMember();
        const memberConfig = mockGenerateMemberConfig();
        memberConfig.isPushNotificationsEnabled = false;
        const user = mockGenerateUser();
        spyOnServiceGetMember.mockImplementationOnce(async () => member);
        spyOnServiceGetMemberConfig.mockImplementationOnce(async () => memberConfig);
        spyOnUserServiceGetUser.mockImplementationOnce(async () => user);

        const notifyParams = generateNotifyParams({ type: params });

        await expect(resolver.notify(notifyParams)).rejects.toThrow(
          Errors.get(ErrorType.notificationNotAllowed),
        );
      },
    );

    it('should trim leading and trailing whitespaces from message', async () => {
      const member = mockGenerateMember();
      const memberConfig = mockGenerateMemberConfig();
      const user = mockGenerateUser();
      const communication = generateCommunication();
      spyOnServiceGetMember.mockImplementationOnce(async () => member);
      spyOnServiceGetMemberConfig.mockImplementationOnce(async () => memberConfig);
      spyOnUserServiceGetUser.mockImplementationOnce(async () => user);
      spyOnCommunicationServiceGet.mockImplementationOnce(async () => communication);
      spyOnCreateDispatch.mockImplementationOnce(async () => undefined);

      const notifyParams = generateNotifyParams({
        type: NotificationType.textSms,
        metadata: { peerId: v4(), content: `    ${faker.lorem.sentence()}     ` },
      });

      await resolver.notify(notifyParams);
      expect(spyOnCreateDispatch).toBeCalled();
    });

    it('should fail sending a message with only whitespaces', async () => {
      const member = mockGenerateMember();
      const memberConfig = mockGenerateMemberConfig();
      const user = mockGenerateUser();
      const communication = generateCommunication();
      spyOnServiceGetMember.mockImplementationOnce(async () => member);
      spyOnServiceGetMemberConfig.mockImplementationOnce(async () => memberConfig);
      spyOnUserServiceGetUser.mockImplementationOnce(async () => user);
      spyOnCommunicationServiceGet.mockImplementationOnce(async () => communication);

      const notifyParams = generateNotifyParams({
        type: NotificationType.textSms,
        metadata: { peerId: v4(), content: '            ' },
      });

      await expect(resolver.notify(notifyParams)).rejects.toThrow(
        Errors.get(ErrorType.notificationInvalidContent),
      );
    });
  });

  describe('notifyContent', () => {
    let spyOnServiceGetMember;
    let spyOnServiceGetMemberConfig;
    let spyOnUserServiceGetUser;

    beforeEach(() => {
      spyOnServiceGetMember = jest.spyOn(service, 'get');
      spyOnServiceGetMemberConfig = jest.spyOn(service, 'getMemberConfig');
      spyOnUserServiceGetUser = jest.spyOn(userService, 'get');
    });

    afterEach(() => {
      spyOnServiceGetMember.mockReset();
      spyOnServiceGetMemberConfig.mockReset();
      spyOnUserServiceGetUser.mockReset();
    });

    it('should catch notify exception on non existing user', async () => {
      const member = mockGenerateMember();
      const memberConfig = mockGenerateMemberConfig();
      spyOnServiceGetMember.mockImplementationOnce(async () => member);
      spyOnServiceGetMemberConfig.mockImplementationOnce(async () => memberConfig);
      spyOnUserServiceGetUser.mockImplementationOnce(async () => undefined);

      await expect(
        resolver.notifyContent(generateNotifyContentParams({ memberId: member.id })),
      ).rejects.toThrow(Errors.get(ErrorType.userNotFound));
    });

    it('should catch notify exception on non existing member', async () => {
      const memberConfig = mockGenerateMemberConfig();
      const user = mockGenerateUser();
      spyOnServiceGetMember.mockImplementationOnce(async () => undefined);
      spyOnServiceGetMemberConfig.mockImplementationOnce(async () => memberConfig);
      spyOnUserServiceGetUser.mockImplementationOnce(async () => user);

      await expect(
        resolver.notifyContent(
          generateNotifyContentParams({
            userId: user.id,
            memberId: memberConfig.memberId.toString(),
          }),
        ),
      ).rejects.toThrow(Errors.get(ErrorType.memberNotFound));
    });

    /* eslint-disable max-len */
    test.each`
      memberConfig                                                         | contentKey                         | error
      ${{ platform: Platform.web }}                                        | ${ExternalKey.addCaregiverDetails} | ${ErrorType.notificationNotAllowedForWebMember}
      ${{ platform: Platform.web }}                                        | ${ExternalKey.setCallPermissions}  | ${ErrorType.notificationNotAllowedForWebMember}
      ${{ isPushNotificationsEnabled: false }}                             | ${ExternalKey.addCaregiverDetails} | ${ErrorType.notificationNotAllowedForWebMember}
      ${{ isPushNotificationsEnabled: false }}                             | ${ExternalKey.setCallPermissions}  | ${ErrorType.notificationNotAllowedForWebMember}
      ${{ platform: Platform.web, isPushNotificationsEnabled: true }}      | ${ExternalKey.addCaregiverDetails} | ${ErrorType.notificationNotAllowedForWebMember}
      ${{ platform: Platform.web, isPushNotificationsEnabled: true }}      | ${ExternalKey.setCallPermissions}  | ${ErrorType.notificationNotAllowedForWebMember}
      ${{ platform: Platform.android, isPushNotificationsEnabled: false }} | ${ExternalKey.setCallPermissions}  | ${ErrorType.notificationNotAllowedForWebMember}
      ${{ platform: Platform.ios, isPushNotificationsEnabled: false }}     | ${ExternalKey.setCallPermissions}  | ${ErrorType.notificationNotAllowedForWebMember}
      ${{ platform: Platform.android, isPushNotificationsEnabled: false }} | ${ExternalKey.setCallPermissions}  | ${ErrorType.notificationNotAllowedForWebMember}
      ${{ platform: Platform.ios, isPushNotificationsEnabled: false }}     | ${ExternalKey.setCallPermissions}  | ${ErrorType.notificationNotAllowedForWebMember}
      ${{ platform: Platform.android }}                                    | ${ExternalKey.scheduleAppointment} | ${ErrorType.notificationNotAllowedForMobileMember}
      ${{ platform: Platform.ios }}                                        | ${ExternalKey.scheduleAppointment} | ${ErrorType.notificationNotAllowedForMobileMember}
    `(
      `should throw an error when memberConfig=$memberConfig and contentKey=$contentKey`,
      async (params) => {
        /* eslint-enable max-len */
        const member = mockGenerateMember();
        const memberConfig = mockGenerateMemberConfig({ ...params.memberConfig });
        const user = mockGenerateUser();
        spyOnServiceGetMember.mockImplementationOnce(async () => member);
        spyOnServiceGetMemberConfig.mockImplementationOnce(async () => memberConfig);
        spyOnUserServiceGetUser.mockImplementationOnce(async () => user);

        await expect(
          resolver.notifyContent(
            generateNotifyContentParams({
              userId: user.id,
              memberId: memberConfig.memberId.toString(),
              contentKey: params.contentKey,
            }),
          ),
        ).rejects.toThrow(Errors.get(params.error));
      },
    );

    // eslint-disable-next-line max-len
    it(`should throw error when there are no requested appointments for ${ExternalKey.scheduleAppointment}`, async () => {
      const member = mockGenerateMember();
      const memberConfig = mockGenerateMemberConfig({
        platform: Platform.web,
        isPushNotificationsEnabled: false,
      });
      const user = {
        ...mockGenerateUser(),
        id: member.primaryUserId,
        appointments: [
          generateScheduleAppointmentParams({ userId: member.primaryUserId.toString() }),
          { ...generateEndAppointmentParams(), userId: member.primaryUserId.toString() },
        ],
      };
      spyOnServiceGetMember.mockImplementationOnce(async () => ({ ...member, users: [user] }));
      spyOnServiceGetMemberConfig.mockImplementationOnce(async () => memberConfig);
      spyOnUserServiceGetUser.mockImplementationOnce(async () => user);

      await expect(
        resolver.notifyContent(
          generateNotifyContentParams({
            userId: member.primaryUserId.toString(),
            memberId: memberConfig.memberId.toString(),
            contentKey: ExternalKey.scheduleAppointment,
          }),
        ),
      ).rejects.toThrow(Errors.get(ErrorType.notificationNotAllowedNoRequestedAppointment));
    });
  });

  describe('notifyChatMessage', () => {
    let spyOnServiceGetMember;
    let spyOnServiceGetMemberConfig;
    let spyOnUserServiceGetUser;
    let spyOnCommunicationGetByUrl;
    let spyOnNotifyCreateDispatch;

    beforeEach(() => {
      spyOnServiceGetMember = jest.spyOn(service, 'get');
      spyOnServiceGetMemberConfig = jest.spyOn(service, 'getMemberConfig');
      spyOnUserServiceGetUser = jest.spyOn(userService, 'get');
      spyOnCommunicationGetByUrl = jest.spyOn(communicationService, 'getByChannelUrlAndUser');
      spyOnNotifyCreateDispatch = jest.spyOn(resolver, 'notifyCreateDispatch');
    });

    afterEach(() => {
      spyOnServiceGetMember.mockReset();
      spyOnServiceGetMemberConfig.mockReset();
      spyOnUserServiceGetUser.mockReset();
      spyOnCommunicationGetByUrl.mockReset();
      spyOnNotifyCreateDispatch.mockReset();
    });

    it('should handle notify chat message sent from user', async () => {
      const member = mockGenerateMember();
      const user = mockGenerateUser();
      const memberConfig: MemberConfig = {
        memberId: new Types.ObjectId(member.id),
        externalUserId: v4(),
        platform: Platform.android,
        isPushNotificationsEnabled: true,
        accessToken: '123-abc',
        firstLoggedInAt: faker.date.past(1),
        articlesPath: faker.system.directoryPath(),
        language: defaultMemberParams.language,
        updatedAt: faker.date.past(1),
      };
      const communication: Communication = {
        memberId: new Types.ObjectId(member.id),
        userId: new Types.ObjectId(user.id),
        sendBirdChannelUrl: generateUniqueUrl(),
      };
      spyOnServiceGetMemberConfig.mockImplementationOnce(async () => memberConfig);
      spyOnServiceGetMember.mockImplementationOnce(async () => member);
      spyOnUserServiceGetUser.mockImplementation(async () => user);
      spyOnCommunicationGetByUrl.mockImplementation(async () => communication);
      const spyOnCreateDispatch = jest.spyOn(resolver, 'notifyCreateDispatch');

      const params: IEventOnReceivedChatMessage = {
        senderUserId: user.id,
        sendBirdChannelUrl: communication.sendBirdChannelUrl,
      };

      await resolver.notifyChatMessage(params);
      expect(spyOnCreateDispatch).toBeCalled();
    });

    it('should notify the coach on chat message sent from member', async () => {
      const member = mockGenerateMember();
      spyOnServiceGetMember.mockImplementation(async () => member);
      const spyOnCreateDispatch = jest.spyOn(resolver, 'notifyCreateDispatch');
      const params: IEventOnReceivedChatMessage = {
        senderUserId: member.id,
        sendBirdChannelUrl: generateUniqueUrl(),
      };

      await resolver.notifyChatMessage(params);
      expect(spyOnCreateDispatch).toBeCalled();
    }, 10000);

    const fakeData: IEventOnReceivedChatMessage = {
      senderUserId: v4(),
      sendBirdChannelUrl: generateUniqueUrl(),
    };

    /* eslint-disable-next-line max-len */
    it('should disregard notify chat message when sent from member and member does not exist', async () => {
      spyOnUserServiceGetUser.mockImplementation(async () => undefined);
      spyOnServiceGetMember.mockImplementation(async () => undefined);

      await resolver.notifyChatMessage(fakeData);
      expect(spyOnNotifyCreateDispatch).not.toBeCalled();
    });

    it('should disregard notify on non existing sendBirdChannelUrl', async () => {
      spyOnUserServiceGetUser.mockImplementation(async () => mockGenerateUser());
      spyOnCommunicationGetByUrl.mockImplementation(async () => undefined);

      await resolver.notifyChatMessage(fakeData);
      expect(spyOnNotifyCreateDispatch).not.toBeCalled();
    });
  });

  describe('dismissAlert', () => {
    let spyOnServiceDismissAlert;
    beforeEach(() => {
      spyOnServiceDismissAlert = jest.spyOn(service, 'dismissAlert');
    });

    afterEach(() => {
      spyOnServiceDismissAlert.mockReset();
    });

    it('should call dismissAlert', async () => {
      const alertId = generateId();
      const userId = generateId();
      await resolver.dismissAlert(userId, alertId);

      expect(spyOnServiceDismissAlert).toBeCalledTimes(1);
      expect(spyOnServiceDismissAlert).toBeCalledWith(userId, alertId);
    });
  });

  describe('getAlerts', () => {
    let spyOnServiceGetAlerts;
    beforeEach(() => {
      spyOnServiceGetAlerts = jest.spyOn(service, 'getAlerts');
    });

    afterEach(() => {
      spyOnServiceGetAlerts.mockReset();
    });

    it('should call getAlerts', async () => {
      const userId = generateId();
      const lastQueryAlert = faker.date.past(1);
      const alert = mockGenerateAlert();

      spyOnServiceGetAlerts.mockResolvedValue([alert]);

      const alerts = await resolver.getAlerts(userId, lastQueryAlert);

      expect(spyOnServiceGetAlerts).toBeCalledTimes(1);
      expect(spyOnServiceGetAlerts).toBeCalledWith(userId, lastQueryAlert);
      expect(alerts).toEqual([alert]);
    });
  });

  describe('handleAlertForQRSubmit', () => {
    let spyOnServiceGetMember;

    beforeEach(() => {
      spyOnServiceGetMember = jest.spyOn(service, 'get');
    });

    afterEach(() => {
      spyOnServiceGetMember.mockReset();
    });

    it('should handle alert for QR submit', async () => {
      const user = mockGenerateUser();
      const member = mockGenerateMember(user);

      spyOnServiceGetMember.mockImplementationOnce(async () => member);

      const params: IEventOnAlertForQRSubmit = {
        memberId: member.id,
        questionnaireName: 'PHQ-9',
        score: '10',
      };

      await resolver.handleAlertForQRSubmit(params);
      expect(spyOnEventEmitter).toHaveBeenCalledWith(EventType.notifySlack, {
        channel: 'slack.escalation',
        header: `*High Assessment Score [${member.org.name}]*`,
        icon: ':warning:',
        message:
          `Alerting results on PHQ-9 for ` +
          `${user.firstName} ${user.lastName}’s member - ` +
          `<https://dev.harmony.lagunahealth.com/details/${member.id}|` +
          `${member.firstName[0].toUpperCase() + member.lastName[0].toUpperCase()}>. Scored a '10'`,
      });
    });
  });
});
