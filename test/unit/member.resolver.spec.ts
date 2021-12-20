import {
  CancelNotificationType,
  ContentKey,
  IEventNotifySlack,
  InnerQueueTypes,
  InternalNotificationType,
  Language,
  NotificationType,
  Platform,
  SlackChannel,
  SlackIcon,
  generateDeleteDispatchMock,
  generateDispatchId,
} from '@lagunahealth/pandora';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import * as config from 'config';
import * as faker from 'faker';
import { Types } from 'mongoose';
import { v4 } from 'uuid';
import {
  ErrorType,
  Errors,
  EventType,
  IEventNotifyQueue,
  IEventOnNewMember,
  IEventOnReceivedChatMessage,
  IEventOnUpdatedMemberPlatform,
  InternalNotifyControlMemberParams,
  InternalNotifyParams,
  InternationalizationService,
  LoggerService,
  MemberRole,
  QueueType,
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
  MemberScheduler,
  MemberService,
  TaskStatus,
} from '../../src/member';
import {
  CognitoService,
  FeatureFlagService,
  NotificationsService,
  StorageService,
} from '../../src/providers';
import { UserService } from '../../src/user';
import {
  dbDisconnect,
  defaultModules,
  generateAppointmentComposeParams,
  generateCancelNotifyParams,
  generateCommunication,
  generateCreateMemberParams,
  generateCreateTaskParams,
  generateGetCommunication,
  generateGetMemberUploadJournalAudioLinkParams,
  generateGetMemberUploadJournalImageLinkParams,
  generateId,
  generateInternalNotifyParams,
  generateMemberConfig,
  generateNotifyParams,
  generateObjectId,
  generateSetGeneralNotesParams,
  generateUniqueUrl,
  generateUpdateClientSettings,
  generateUpdateJournalTextParams,
  generateUpdateMemberConfigParams,
  generateUpdateMemberParams,
  generateUpdateRecordingParams,
  generateUpdateTaskStatusParams,
  mockGenerateMember,
  mockGenerateMemberConfig,
  mockGenerateUser,
  mockLogger,
} from '../index';
import { iceServers } from './mocks/twilioPeerIceServers';

describe('MemberResolver', () => {
  let module: TestingModule;
  let resolver: MemberResolver;
  let service: MemberService;
  let memberScheduler: MemberScheduler;
  let userService: UserService;
  let storage: StorageService;
  let cognitoService: CognitoService;
  let communicationResolver: CommunicationResolver;
  let notificationsService: NotificationsService;
  let communicationService: CommunicationService;
  let eventEmitter: EventEmitter2;
  let internationalizationService: InternationalizationService;
  let featureFlagService: FeatureFlagService;
  let spyOnEventEmitter;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: defaultModules().concat(MemberModule),
    }).compile();

    resolver = module.get<MemberResolver>(MemberResolver);
    service = module.get<MemberService>(MemberService);
    userService = module.get<UserService>(UserService);
    userService = module.get<UserService>(UserService);
    storage = module.get<StorageService>(StorageService);
    cognitoService = module.get<CognitoService>(CognitoService);
    notificationsService = module.get<NotificationsService>(NotificationsService);
    communicationResolver = module.get<CommunicationResolver>(CommunicationResolver);
    communicationService = module.get<CommunicationService>(CommunicationService);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
    spyOnEventEmitter = jest.spyOn(eventEmitter, 'emit');
    memberScheduler = module.get<MemberScheduler>(MemberScheduler);
    featureFlagService = module.get<FeatureFlagService>(FeatureFlagService);
    internationalizationService = module.get<InternationalizationService>(
      InternationalizationService,
    );
    mockLogger(module.get<LoggerService>(LoggerService));

    await internationalizationService.onModuleInit();
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

    beforeEach(() => {
      spyOnServiceInsert = jest.spyOn(service, 'insert');
      spyOnServiceInsertControl = jest.spyOn(service, 'insertControl');
      spyOnServiceGetAvailableUser = jest.spyOn(userService, 'getAvailableUser');
      spyOnUserServiceGetUser = jest.spyOn(userService, 'get');
      spyOnServiceGetMemberConfig = jest.spyOn(service, 'getMemberConfig');
      spyOnFeatureFlagControlGroup = jest.spyOn(featureFlagService, 'isControlGroup');
    });

    afterEach(() => {
      spyOnServiceInsert.mockReset();
      spyOnServiceInsertControl.mockReset();
      spyOnServiceGetAvailableUser.mockReset();
      spyOnUserServiceGetUser.mockReset();
      spyOnServiceGetMemberConfig.mockReset();
      spyOnEventEmitter.mockReset();
      spyOnFeatureFlagControlGroup.mockReset();
    });

    it('should create a member', async () => {
      const member = mockGenerateMember();
      const user = mockGenerateUser();
      const memberConfig = generateMemberConfig({
        memberId: generateObjectId(member.id),
        platform: Platform.android,
      });
      spyOnServiceInsert.mockImplementationOnce(async () => ({ member, memberConfig }));
      spyOnServiceGetMemberConfig.mockImplementationOnce(async () => memberConfig);
      spyOnServiceGetAvailableUser.mockImplementationOnce(async () => member.primaryUserId);
      spyOnUserServiceGetUser.mockImplementationOnce(async () => user);
      spyOnFeatureFlagControlGroup.mockImplementationOnce(async () => false);

      const params = generateCreateMemberParams({ orgId: generateId() });
      await resolver.createMember(params);

      expect(spyOnServiceInsert).toBeCalledTimes(1);
      expect(spyOnServiceInsert).toBeCalledWith(params, member.primaryUserId);
      expect(spyOnServiceGetAvailableUser).toBeCalledTimes(1);
      expect(spyOnServiceGetMemberConfig).toBeCalledTimes(1);
      expect(spyOnServiceGetMemberConfig).toBeCalledWith(member.id);
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
        message: `*New customer*\n${member.firstName} [${member.id}],\nassigned to ${user.firstName}.`,
        icon: SlackIcon.info,
        channel: SlackChannel.support,
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
      spyOnServiceInsert.mockImplementationOnce(async () => ({ member, memberConfig }));
      spyOnServiceGetMemberConfig.mockImplementationOnce(async () => memberConfig);
      spyOnServiceGetAvailableUser.mockImplementationOnce(async () => member.primaryUserId);
      spyOnUserServiceGetUser.mockImplementationOnce(async () => user);
      //forcing true to be sure it won't be control member, even if control rolled true.
      spyOnFeatureFlagControlGroup.mockImplementationOnce(async () => true);

      const params = generateCreateMemberParams({ orgId: generateId(), userId: user.id });
      await resolver.createMember(params);

      expect(spyOnServiceInsert).toBeCalledTimes(1);
      expect(spyOnServiceInsert).toBeCalledWith(params, Types.ObjectId(user.id));
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
        message: `*New customer*\n${member.firstName} [${member.id}],\nassigned to ${user.firstName}.`,
        icon: SlackIcon.info,
        channel: SlackChannel.support,
      };
      expect(spyOnEventEmitter).toBeCalledWith(EventType.notifySlack, eventSlackMessageParams);
    });

    it('should create a control member', async () => {
      const member = mockGenerateMember();
      spyOnServiceInsertControl.mockImplementationOnce(async () => member);
      spyOnFeatureFlagControlGroup.mockImplementationOnce(async () => true);

      const params = generateCreateMemberParams({ orgId: generateId() });
      const result = await resolver.createMember(params);

      expect(spyOnServiceInsertControl).toBeCalledTimes(1);
      expect(spyOnServiceInsertControl).toBeCalledWith(params);
      const eventParams: InternalNotifyControlMemberParams = {
        memberId: result.id,
        type: InternalNotificationType.textSmsToMember,
        metadata: { contentType: ContentKey.newControlMember },
      };
      expect(spyOnEventEmitter).toBeCalledWith(EventType.notifyInternalControlMember, eventParams);
    });
  });

  describe('updateMember', () => {
    let spyOnServiceUpdate;
    beforeEach(() => {
      spyOnServiceUpdate = jest.spyOn(service, 'update');
    });

    afterEach(() => {
      spyOnServiceUpdate.mockReset();
    });

    it('should update a member', async () => {
      const updateMemberParams = generateUpdateMemberParams();
      spyOnServiceUpdate.mockImplementationOnce(async () => updateMemberParams);

      await resolver.updateMember(updateMemberParams);

      expect(spyOnServiceUpdate).toBeCalledTimes(1);
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

    it('should get a member for a given context', async () => {
      const member = mockGenerateMember();
      spyOnServiceGet.mockImplementationOnce(async () => member);
      const result = await resolver.getMember([MemberRole.member], member.id);

      expect(result).toEqual(member);
    });

    it('should get a member for a given id', async () => {
      const member = mockGenerateMember();
      spyOnServiceGet.mockImplementationOnce(async () => member);
      const result = await resolver.getMember([MemberRole.member], member.id);
      expect(result).toEqual(member);
    });

    it('should throw exception on a non valid member', async () => {
      spyOnServiceGet.mockImplementationOnce(async () => {
        throw Error(Errors.get(ErrorType.memberNotFound));
      });
      await expect(resolver.getMember([MemberRole.member], generateId())).rejects.toThrow(
        Errors.get(ErrorType.memberNotFound),
      );
    });

    it('should throw exception on a non valid member', async () => {
      spyOnServiceGet.mockImplementationOnce(async () => {
        throw Error(Errors.get(ErrorType.memberNotFound));
      });
      await expect(resolver.getMember([MemberRole.member], 'not-valid')).rejects.toThrow(
        Errors.get(ErrorType.memberNotFound),
      );
    });

    it('should return org zip code if member does not have one', async () => {
      const member: any = mockGenerateMember();
      delete member.zipCode;
      spyOnServiceGet.mockResolvedValue(member);
      const result = await resolver.getMember([MemberRole.member], member.id);
      expect(result.zipCode).toEqual(member.org.zipCode);
    });

    it('should calculate utcDelta if zipCode exists', async () => {
      const member: any = mockGenerateMember();
      spyOnServiceGet.mockResolvedValue(member);
      const result = await resolver.getMember([MemberRole.member], member.id);
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

  describe('archiveMember', () => {
    let spyOnServiceMoveMemberToArchive;
    let spyOnCognitoServiceDisableMember;
    let spyOnCommunicationFreezeGroupChannel;
    let spyOnNotificationsServiceUnregister;
    beforeEach(() => {
      spyOnServiceMoveMemberToArchive = jest.spyOn(service, 'moveMemberToArchive');
      spyOnCognitoServiceDisableMember = jest.spyOn(cognitoService, 'disableMember');
      spyOnCommunicationFreezeGroupChannel = jest.spyOn(communicationService, 'freezeGroupChannel');
      spyOnNotificationsServiceUnregister = jest.spyOn(notificationsService, 'unregister');
    });

    afterEach(() => {
      spyOnServiceMoveMemberToArchive.mockReset();
      spyOnCognitoServiceDisableMember.mockReset();
      spyOnCommunicationFreezeGroupChannel.mockReset();
      spyOnNotificationsServiceUnregister.mockReset();
      spyOnEventEmitter.mockReset();
    });

    it('should archive a member given an id', async () => {
      const member = mockGenerateMember();
      const memberConfig = generateMemberConfig({ memberId: generateObjectId(member.id) });
      spyOnServiceMoveMemberToArchive.mockImplementationOnce(async () => ({
        member,
        memberConfig,
      }));
      spyOnCognitoServiceDisableMember.mockImplementationOnce(() => undefined);
      spyOnCommunicationFreezeGroupChannel.mockImplementationOnce(() => undefined);
      spyOnNotificationsServiceUnregister.mockImplementationOnce(() => undefined);

      const result = await resolver.archiveMember(member.id);

      await delay(300);

      expect(result).toBeTruthy();
      expect(spyOnServiceMoveMemberToArchive).toBeCalledWith(member.id);
      expect(spyOnCognitoServiceDisableMember).toBeCalledWith(member.deviceId);
      expect(spyOnCommunicationFreezeGroupChannel).toBeCalledWith({
        memberId: member.id,
        userId: member.primaryUserId.toString(),
      });
      expect(spyOnNotificationsServiceUnregister).toBeCalledWith(memberConfig);

      expect(spyOnEventEmitter).toBeCalledTimes(5);
      expectDeleteArchiveMember(member.id);
    });
  });

  describe('deleteMember', () => {
    let spyOnServiceDeleteMember;
    let spyOnUserServiceRemoveAppointmentsFromUser;
    let spyOnCommunicationGetMemberUserCommunication;
    let spyOnCommunicationDeleteCommunication;
    let spyOnNotificationsServiceUnregister;
    let spyOnCognitoServiceDeleteMember;
    let spyOnStorageServiceDeleteMember;

    beforeEach(() => {
      spyOnServiceDeleteMember = jest.spyOn(service, 'deleteMember');
      spyOnUserServiceRemoveAppointmentsFromUser = jest.spyOn(userService, 'deleteAppointments');
      spyOnCommunicationGetMemberUserCommunication = jest.spyOn(
        communicationService,
        'getMemberUserCommunication',
      );
      spyOnCommunicationDeleteCommunication = jest.spyOn(
        communicationService,
        'deleteCommunication',
      );
      spyOnNotificationsServiceUnregister = jest.spyOn(notificationsService, 'unregister');
      spyOnCognitoServiceDeleteMember = jest.spyOn(cognitoService, 'deleteMember');
      spyOnStorageServiceDeleteMember = jest.spyOn(storage, 'deleteMember');
    });

    afterEach(() => {
      spyOnServiceDeleteMember.mockReset();
      spyOnUserServiceRemoveAppointmentsFromUser.mockReset();
      spyOnCommunicationGetMemberUserCommunication.mockReset();
      spyOnCommunicationDeleteCommunication.mockReset();
      spyOnCognitoServiceDeleteMember.mockReset();
      spyOnNotificationsServiceUnregister.mockReset();
      spyOnStorageServiceDeleteMember.mockReset();
      spyOnEventEmitter.mockReset();
    });

    it('should be able to delete a member and his/her cognito identification', async () => {
      const member = mockGenerateMember();
      await deleteMemberAux(member);
    });

    it('should be able to delete a member without cognito identification(device id)', async () => {
      const member = mockGenerateMember();
      delete member.deviceId;
      await deleteMemberAux(member);
    });

    const deleteMemberAux = async (member: Member) => {
      const memberConfig = generateMemberConfig({ memberId: generateObjectId(member.id) });
      const appointments = [generateAppointmentComposeParams(), generateAppointmentComposeParams()];
      const communication = generateCommunication({
        memberId: generateObjectId(member.id),
        userId: member.primaryUserId,
      });
      spyOnServiceDeleteMember.mockImplementationOnce(async () => ({
        member,
        memberConfig,
        appointments,
      }));
      spyOnUserServiceRemoveAppointmentsFromUser.mockImplementationOnce(() => undefined);
      spyOnCommunicationGetMemberUserCommunication.mockImplementationOnce(() => communication);
      spyOnCommunicationDeleteCommunication.mockImplementationOnce(() => undefined);
      spyOnCognitoServiceDeleteMember.mockImplementationOnce(() => undefined);
      spyOnNotificationsServiceUnregister.mockImplementationOnce(() => undefined);
      spyOnStorageServiceDeleteMember.mockImplementationOnce(() => undefined);

      const result = await resolver.deleteMember(member.id);
      await delay(500);

      expect(result).toBeTruthy();
      expect(spyOnCommunicationDeleteCommunication).toBeCalledWith(communication);
      expect(spyOnNotificationsServiceUnregister).toBeCalledWith(memberConfig);
      if (member.deviceId) {
        expect(spyOnCognitoServiceDeleteMember).toBeCalledWith(member.deviceId);
      } else {
        expect(spyOnCognitoServiceDeleteMember).not.toHaveBeenCalled();
      }
      expect(spyOnStorageServiceDeleteMember).toBeCalledWith(member.id);

      expect(spyOnEventEmitter).toBeCalledTimes(6);
      expectDeleteArchiveMember(member.id);
    };
  });

  const expectDeleteArchiveMember = (memberId: string) => {
    const queueEventParams: IEventNotifyQueue = {
      type: QueueType.notifications,
      message: JSON.stringify({ type: InnerQueueTypes.deleteClientSettings, id: memberId }),
    };
    expect(spyOnEventEmitter).toHaveBeenNthCalledWith(1, EventType.notifyQueue, queueEventParams);
    const generateQueueParams = (contentKey: ContentKey): IEventNotifyQueue => {
      return {
        type: QueueType.notifications,
        message: JSON.stringify(
          generateDeleteDispatchMock({
            dispatchId: generateDispatchId(contentKey, memberId),
          }),
        ),
      };
    };
    expect(spyOnEventEmitter).toHaveBeenNthCalledWith(
      2,
      EventType.notifyQueue,
      generateQueueParams(ContentKey.newMemberNudge),
    );
    expect(spyOnEventEmitter).toHaveBeenNthCalledWith(
      3,
      EventType.notifyQueue,
      generateQueueParams(ContentKey.newRegisteredMember),
    );
    expect(spyOnEventEmitter).toHaveBeenNthCalledWith(
      4,
      EventType.notifyQueue,
      generateQueueParams(ContentKey.newRegisteredMemberNudge),
    );
  };

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

    it('should get a member download discharge documents links for a given context', async () => {
      const member = mockGenerateMember();
      spyOnServiceGet.mockImplementationOnce(async () => member);
      spyOnStorage.mockImplementation(async () => 'https://aws-bucket-path/extras');
      await resolver.getMemberDownloadDischargeDocumentsLinks(
        [MemberRole.member],
        member.id,
        member.id,
      );

      checkDocumentsCall(member, spyOnServiceGet, spyOnStorage);
    });

    it('should throw exception on a non valid member', async () => {
      spyOnServiceGet.mockImplementationOnce(async () => {
        throw Error(Errors.get(ErrorType.memberNotFound));
      });

      await expect(
        resolver.getMemberDownloadDischargeDocumentsLinks(
          [MemberRole.member],
          generateId(),
          generateId(),
        ),
      ).rejects.toThrow(Errors.get(ErrorType.memberNotFound));
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
    let spyOnNotificationsServiceSend;
    let spyOnServiceGetMember;
    let spyOnServiceGetMemberConfig;
    let spyOnUserServiceGetUser;

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
      spyOnNotificationsServiceSend = jest.spyOn(notificationsService, 'send');
      spyOnServiceGetMember = jest.spyOn(service, 'get');
      spyOnServiceGetMemberConfig = jest.spyOn(service, 'getMemberConfig');
      spyOnUserServiceGetUser = jest.spyOn(userService, 'get');
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
      spyOnNotificationsServiceSend.mockReset();
      spyOnServiceGetMember.mockReset();
      spyOnServiceGetMemberConfig.mockReset();
      spyOnUserServiceGetUser.mockReset();
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
      const url = generateUniqueUrl();
      spyOnServiceUpdateJournal.mockImplementationOnce(async () => journal);
      spyOnStorageDeleteJournalImages.mockImplementationOnce(async () => true);
      spyOnCommunicationServiceGet.mockImplementationOnce(async () => communication);
      spyOnStorageGetDownloadUrl.mockImplementation(async () => url);
      spyOnServiceGetMember.mockImplementation(async () => member);
      spyOnServiceGetMemberConfig.mockImplementationOnce(async () => memberConfig);
      spyOnUserServiceGetUser.mockImplementationOnce(async () => user);
      spyOnNotificationsServiceSend.mockImplementationOnce(async () => undefined);

      await resolver.publishJournal([MemberRole.member], memberId, journal.id);

      expect(spyOnServiceUpdateJournal).toBeCalledTimes(1);
      expect(spyOnServiceUpdateJournal).toBeCalledWith({
        id: journal.id,
        memberId,
        published: true,
      });

      expect(spyOnServiceGetMember).toBeCalledTimes(2);
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
      expect(spyOnNotificationsServiceSend).toBeCalledWith({
        sendSendBirdNotification: {
          message: journal.text,
          notificationType: InternalNotificationType.chatMessageJournal,
          orgName: member.org.name,
          userId: member.id,
          sendBirdChannelUrl: communication.sendBirdChannelUrl,
          journalImageDownloadLink: url,
        },
      });
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
      const url = generateUniqueUrl();
      spyOnServiceUpdateJournal.mockImplementationOnce(async () => journal);
      spyOnStorageDeleteJournalImages.mockImplementationOnce(async () => true);
      spyOnCommunicationServiceGet.mockImplementationOnce(async () => communication);
      spyOnStorageGetDownloadUrl.mockImplementation(async () => url);
      spyOnServiceGetJournal.mockImplementationOnce(async () => journal);
      spyOnServiceGetMember.mockImplementation(async () => member);
      spyOnServiceGetMemberConfig.mockImplementationOnce(async () => memberConfig);
      spyOnUserServiceGetUser.mockImplementationOnce(async () => user);
      spyOnNotificationsServiceSend.mockImplementationOnce(async () => undefined);

      await resolver.publishJournal([MemberRole.member], memberId, journal.id);

      expect(spyOnStorageGetDownloadUrl).toReturnTimes(0);
      expect(spyOnNotificationsServiceSend).toBeCalledWith({
        sendSendBirdNotification: {
          message: journal.text,
          notificationType: InternalNotificationType.chatMessageJournal,
          orgName: member.org.name,
          userId: member.id,
          sendBirdChannelUrl: communication.sendBirdChannelUrl,
        },
      });
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
      await resolver.getMemberConfig(
        [MemberRole.member],
        memberConfig.memberId.toString(),
        memberConfig.memberId.toString(),
      );

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
    let spyOnNotificationsServiceRegister;
    let spyOnServiceGetMember;
    let spyOnServiceGetMemberConfig;
    let spyOnServiceUpdateMemberConfig;
    let spyOnServiceUpdateMemberConfigRegisteredAt;
    let spyOnSchedulerDeleteTimeout;

    beforeEach(() => {
      spyOnNotificationsServiceRegister = jest.spyOn(notificationsService, 'register');
      spyOnServiceGetMember = jest.spyOn(service, 'get');
      spyOnServiceGetMemberConfig = jest.spyOn(service, 'getMemberConfig');
      spyOnServiceUpdateMemberConfig = jest.spyOn(service, 'updateMemberConfig');
      spyOnServiceUpdateMemberConfigRegisteredAt = jest.spyOn(
        service,
        'updateMemberConfigRegisteredAt',
      );
      spyOnSchedulerDeleteTimeout = jest.spyOn(memberScheduler, 'deleteTimeout');
    });

    afterEach(() => {
      spyOnNotificationsServiceRegister.mockReset();
      spyOnServiceGetMember.mockReset();
      spyOnServiceGetMemberConfig.mockReset();
      spyOnServiceUpdateMemberConfig.mockReset();
      spyOnServiceUpdateMemberConfigRegisteredAt.mockReset();
      spyOnSchedulerDeleteTimeout.mockReset();
      spyOnEventEmitter.mockReset();
      spyOnEventEmitter.mockClear();
    });

    it('should not call notificationsService on platform=android', async () => {
      spyOnNotificationsServiceRegister.mockImplementationOnce(async () => undefined);
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

      expect(spyOnNotificationsServiceRegister).not.toBeCalled();
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

      expect(spyOnNotificationsServiceRegister).toBeCalledTimes(1);
      expect(spyOnNotificationsServiceRegister).toBeCalledWith({
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
      await resolver.updateRecording(recording);

      expect(spyOnServiceUpdate).toBeCalledTimes(1);
      expect(spyOnServiceUpdate).toBeCalledWith(recording);
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
    let spyOnNotificationsServiceSend;
    let spyOnNotificationsServiceCreatePeerIceServers;
    let spyOnNotificationsServiceCancel;
    let spyOnCommunicationResolverGetCommunication;
    let spyOnCommunicationServiceGet;

    beforeEach(() => {
      spyOnServiceGetMember = jest.spyOn(service, 'get');
      spyOnServiceGetMemberConfig = jest.spyOn(service, 'getMemberConfig');
      spyOnUserServiceGetUser = jest.spyOn(userService, 'get');
      spyOnNotificationsServiceSend = jest.spyOn(notificationsService, 'send');
      spyOnNotificationsServiceCreatePeerIceServers = jest.spyOn(
        notificationsService,
        'createPeerIceServers',
      );
      spyOnNotificationsServiceCancel = jest.spyOn(notificationsService, 'cancel');
      spyOnCommunicationResolverGetCommunication = jest.spyOn(
        communicationResolver,
        'getCommunication',
      );
      spyOnCommunicationServiceGet = jest.spyOn(communicationService, 'get');
    });

    afterEach(() => {
      spyOnServiceGetMember.mockReset();
      spyOnServiceGetMemberConfig.mockReset();
      spyOnUserServiceGetUser.mockReset();
      spyOnNotificationsServiceSend.mockReset();
      spyOnNotificationsServiceCreatePeerIceServers.mockReset();
      spyOnNotificationsServiceCancel.mockReset();
      spyOnCommunicationResolverGetCommunication.mockReset();
      spyOnCommunicationServiceGet.mockReset();
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
      spyOnNotificationsServiceSend.mockImplementationOnce(async () => undefined);
      spyOnNotificationsServiceCreatePeerIceServers.mockResolvedValueOnce({ iceServers });

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
        spyOnNotificationsServiceSend.mockImplementationOnce(async () => undefined);

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
        spyOnNotificationsServiceSend.mockImplementationOnce(async () => undefined);

        const notifyParams = generateNotifyParams({ type: params });

        await expect(resolver.notify(notifyParams)).rejects.toThrow(
          Errors.get(ErrorType.notificationNotAllowed),
        );
      },
    );

    it('should send to Sendbird on type textSms', async () => {
      const member = mockGenerateMember();
      const memberConfig = mockGenerateMemberConfig();
      const user = mockGenerateUser();
      const communication = generateCommunication();
      spyOnServiceGetMember.mockImplementationOnce(async () => member);
      spyOnServiceGetMemberConfig.mockImplementationOnce(async () => memberConfig);
      spyOnUserServiceGetUser.mockImplementationOnce(async () => user);
      spyOnNotificationsServiceSend.mockImplementationOnce(async () => undefined);
      spyOnCommunicationServiceGet.mockImplementationOnce(async () => communication);

      const notifyParams = generateNotifyParams({
        type: NotificationType.textSms,
      });

      await resolver.notify(notifyParams);

      expect(spyOnNotificationsServiceSend).toBeCalledWith({
        sendSendBirdNotification: {
          userId: user.id,
          sendBirdChannelUrl: communication.sendBirdChannelUrl,
          message: notifyParams.metadata.content,
          notificationType: NotificationType.textSms,
          orgName: member.org.name,
        },
      });
    });

    it('should send SMS on type textSms', async () => {
      const member = mockGenerateMember();
      const memberConfig = mockGenerateMemberConfig();
      const user = mockGenerateUser();
      const communication = generateCommunication();
      spyOnServiceGetMember.mockImplementationOnce(async () => member);
      spyOnServiceGetMemberConfig.mockImplementationOnce(async () => memberConfig);
      spyOnUserServiceGetUser.mockImplementationOnce(async () => user);
      spyOnNotificationsServiceSend.mockImplementationOnce(async () => undefined);
      spyOnCommunicationServiceGet.mockImplementationOnce(async () => communication);

      const notifyParams = generateNotifyParams({
        type: NotificationType.textSms,
      });

      await resolver.notify(notifyParams);

      expect(spyOnNotificationsServiceSend).toBeCalledWith({
        sendTwilioNotification: {
          body: notifyParams.metadata.content,
          to: member.phone,
          orgName: member.org.name,
        },
      });
    });

    it('should send SMS on type text if platform', async () => {
      const member = mockGenerateMember();
      const memberConfig = mockGenerateMemberConfig();
      memberConfig.platform = Platform.web;
      const user = mockGenerateUser();
      spyOnServiceGetMember.mockImplementationOnce(async () => member);
      spyOnServiceGetMemberConfig.mockImplementationOnce(async () => memberConfig);
      spyOnUserServiceGetUser.mockImplementationOnce(async () => user);
      spyOnNotificationsServiceSend.mockImplementationOnce(async () => undefined);

      const notifyParams = generateNotifyParams({
        type: NotificationType.text,
      });

      await resolver.notify(notifyParams);

      expect(spyOnNotificationsServiceSend).toBeCalledWith({
        sendTwilioNotification: {
          body: notifyParams.metadata.content,
          to: member.phone,
          orgName: member.org.name,
        },
      });
    });

    it('should send SMS on type text if notification disabled', async () => {
      const member = mockGenerateMember();
      const memberConfig = mockGenerateMemberConfig();
      memberConfig.isPushNotificationsEnabled = false;
      const user = mockGenerateUser();
      spyOnServiceGetMember.mockImplementationOnce(async () => member);
      spyOnServiceGetMemberConfig.mockImplementationOnce(async () => memberConfig);
      spyOnUserServiceGetUser.mockImplementationOnce(async () => user);
      spyOnNotificationsServiceSend.mockImplementationOnce(async () => undefined);

      const notifyParams = generateNotifyParams({
        type: NotificationType.text,
      });

      await resolver.notify(notifyParams);

      expect(spyOnNotificationsServiceSend).toBeCalledWith({
        sendTwilioNotification: {
          body: notifyParams.metadata.content,
          to: member.phone,
          orgName: member.org.name,
        },
      });
    });

    test.each([NotificationType.call, NotificationType.video])(
      'should send push notification if type video or call',
      async (type) => {
        const member = mockGenerateMember();
        const memberConfig = mockGenerateMemberConfig();
        const user = mockGenerateUser();
        spyOnServiceGetMember.mockImplementationOnce(async () => member);
        spyOnServiceGetMemberConfig.mockImplementationOnce(async () => memberConfig);
        spyOnUserServiceGetUser.mockImplementationOnce(async () => user);
        spyOnNotificationsServiceSend.mockImplementationOnce(async () => undefined);
        spyOnNotificationsServiceCreatePeerIceServers.mockReturnValueOnce({ iceServers });

        const notifyParams = generateNotifyParams({ type });

        await resolver.notify(notifyParams);

        expect(spyOnNotificationsServiceSend).toBeCalledWith({
          sendOneSignalNotification: {
            platform: memberConfig.platform,
            externalUserId: memberConfig.externalUserId,
            data: {
              user: { id: user.id, firstName: user.firstName, avatar: user.avatar },
              member: { phone: member.phone },
              type,
              path: 'call',
              isVideo: type === NotificationType.video,
              peerId: notifyParams.metadata.peerId,
              extraData: JSON.stringify({ iceServers }),
            },
            content: notifyParams.metadata.content,
            orgName: member.org.name,
          },
        });
      },
    );

    it('should register for future notify', async () => {
      const member = mockGenerateMember();
      const memberConfig = mockGenerateMemberConfig();
      const user = mockGenerateUser();
      spyOnServiceGetMember.mockImplementation(async () => member);
      spyOnServiceGetMemberConfig.mockImplementation(async () => memberConfig);
      spyOnUserServiceGetUser.mockImplementation(async () => user);
      spyOnNotificationsServiceSend.mockImplementationOnce(async () => undefined);

      await memberScheduler.init();

      const when = new Date();
      when.setMilliseconds(when.getMilliseconds() + 100);

      const notifyParams = generateNotifyParams({
        memberId: member.id,
        userId: member.primaryUserId.toString(),
        type: NotificationType.text,
        metadata: { content: faker.lorem.word(), when },
      });

      await resolver.notify(notifyParams);

      await delay(300);
      delete notifyParams.metadata.when;
      const eventParams: InternalNotifyParams = {
        memberId: member.id,
        userId: member.primaryUserId.toString(),
        type:
          notifyParams.type === NotificationType.text
            ? InternalNotificationType.textToMember
            : InternalNotificationType.textSmsToMember,
        metadata: {},
        content: notifyParams.metadata.content,
      };
      expect(spyOnEventEmitter).toBeCalledWith(EventType.notifyInternal, eventParams);
    }, 10000);

    it('should call getCommunication if metadata.chatLink true', async () => {
      const member = mockGenerateMember();
      const memberConfig = mockGenerateMemberConfig();
      const user = mockGenerateUser();
      spyOnServiceGetMember.mockImplementation(async () => member);
      spyOnServiceGetMemberConfig.mockImplementation(async () => memberConfig);
      spyOnUserServiceGetUser.mockImplementation(async () => user);
      spyOnNotificationsServiceSend.mockImplementationOnce(async () => undefined);
      spyOnCommunicationResolverGetCommunication.mockImplementationOnce(async () =>
        generateGetCommunication(),
      );

      const notifyParams = generateNotifyParams({
        memberId: member.id,
        userId: member.primaryUserId.toString(),
        type: NotificationType.text,
        metadata: { content: faker.lorem.word(), chatLink: true },
      });

      await resolver.notify(notifyParams);

      expect(spyOnCommunicationResolverGetCommunication).toBeCalledWith({
        memberId: member.id,
        userId: member.primaryUserId.toString(),
      });
    });

    it('should trim leading and trailing whitespaces from message', async () => {
      const member = mockGenerateMember();
      const memberConfig = mockGenerateMemberConfig();
      const user = mockGenerateUser();
      const communication = generateCommunication();
      spyOnServiceGetMember.mockImplementationOnce(async () => member);
      spyOnServiceGetMemberConfig.mockImplementationOnce(async () => memberConfig);
      spyOnUserServiceGetUser.mockImplementationOnce(async () => user);
      spyOnNotificationsServiceSend.mockImplementationOnce(async () => undefined);
      spyOnCommunicationServiceGet.mockImplementationOnce(async () => communication);

      const notifyParams = generateNotifyParams({
        type: NotificationType.textSms,
        metadata: { peerId: v4(), content: '    test message     ' },
      });

      await resolver.notify(notifyParams);

      expect(spyOnNotificationsServiceSend).toBeCalledWith({
        sendSendBirdNotification: {
          userId: user.id,
          sendBirdChannelUrl: communication.sendBirdChannelUrl,
          message: 'test message',
          notificationType: NotificationType.textSms,
          orgName: member.org.name,
        },
      });
    });

    it('should fail sending a message with only whitespaces', async () => {
      const member = mockGenerateMember();
      const memberConfig = mockGenerateMemberConfig();
      const user = mockGenerateUser();
      const communication = generateCommunication();
      spyOnServiceGetMember.mockImplementationOnce(async () => member);
      spyOnServiceGetMemberConfig.mockImplementationOnce(async () => memberConfig);
      spyOnUserServiceGetUser.mockImplementationOnce(async () => user);
      spyOnNotificationsServiceSend.mockImplementationOnce(async () => undefined);
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

  describe('cancelNotify', () => {
    let spyOnServiceGetMember;
    let spyOnServiceGetMemberConfig;
    let spyOnNotificationsServiceCancel;

    beforeEach(() => {
      spyOnServiceGetMember = jest.spyOn(service, 'get');
      spyOnServiceGetMemberConfig = jest.spyOn(service, 'getMemberConfig');
      spyOnNotificationsServiceCancel = jest.spyOn(notificationsService, 'cancel');
    });

    afterEach(() => {
      spyOnServiceGetMember.mockReset();
      spyOnServiceGetMemberConfig.mockReset();
      spyOnNotificationsServiceCancel.mockReset();
    });

    afterEach(() => {
      spyOnServiceGetMember.mockReset();
      spyOnServiceGetMemberConfig.mockReset();
      spyOnNotificationsServiceCancel.mockReset();
    });

    test.each([
      CancelNotificationType.cancelVideo,
      CancelNotificationType.cancelCall,
      CancelNotificationType.cancelText,
    ])(`should cancel a notification`, async (params) => {
      const member = mockGenerateMember();
      const memberConfig = mockGenerateMemberConfig();
      spyOnServiceGetMember.mockImplementationOnce(async () => member);
      spyOnServiceGetMemberConfig.mockImplementationOnce(async () => memberConfig);
      spyOnNotificationsServiceCancel.mockImplementationOnce(async () => undefined);

      const cancelNotifyParams = generateCancelNotifyParams({ type: params });

      await resolver.cancelNotify(cancelNotifyParams);

      expect(spyOnNotificationsServiceCancel).toBeCalledWith({
        externalUserId: memberConfig.externalUserId,
        platform: memberConfig.platform,
        data: {
          type: cancelNotifyParams.type,
          peerId: cancelNotifyParams.metadata.peerId,
          notificationId: cancelNotifyParams.notificationId,
        },
      });
    });
  });

  describe('internalNotify', () => {
    let spyOnServiceGetMember;
    let spyOnServiceGetMemberConfig;
    let spyOnUserServiceGetUser;
    let spyOnNotificationsServiceSend;
    let spyOnNotificationsServiceCancel;

    beforeEach(() => {
      spyOnServiceGetMember = jest.spyOn(service, 'get');
      spyOnServiceGetMemberConfig = jest.spyOn(service, 'getMemberConfig');
      spyOnUserServiceGetUser = jest.spyOn(userService, 'get');
      spyOnNotificationsServiceSend = jest.spyOn(notificationsService, 'send');
      spyOnNotificationsServiceCancel = jest.spyOn(notificationsService, 'cancel');
    });

    afterEach(() => {
      spyOnServiceGetMember.mockReset();
      spyOnServiceGetMemberConfig.mockReset();
      spyOnUserServiceGetUser.mockReset();
      spyOnNotificationsServiceSend.mockReset();
      spyOnNotificationsServiceCancel.mockReset();
    });

    test.each`
      type                                        | isMember
      ${InternalNotificationType.textSmsToMember} | ${true}
      ${InternalNotificationType.textSmsToUser}   | ${false}
    `('should send SMS notification for $type', async (params) => {
      const member = mockGenerateMember();
      const memberConfig = mockGenerateMemberConfig();
      const user = mockGenerateUser();
      spyOnServiceGetMember.mockImplementationOnce(async () => member);
      spyOnServiceGetMemberConfig.mockImplementationOnce(async () => memberConfig);
      spyOnUserServiceGetUser.mockImplementationOnce(async () => user);
      spyOnNotificationsServiceSend.mockImplementationOnce(async () => undefined);

      const internalNotifyParams = generateInternalNotifyParams({
        type: params.type,
      });

      await resolver.internalNotify(internalNotifyParams);

      expect(spyOnNotificationsServiceSend).toBeCalledWith({
        sendTwilioNotification: {
          orgName: member.org.name,
          body: internalNotifyParams.content,
          to: params.isMember ? member.phone : user.phone,
        },
      });
    });

    // eslint-disable-next-line max-len
    it('should send SMS notification for textToMember if platform web and not add dynamic link to the content', async () => {
      const member = mockGenerateMember();
      const memberConfig = mockGenerateMemberConfig();
      memberConfig.platform = Platform.web;
      const user = mockGenerateUser();
      spyOnServiceGetMember.mockImplementationOnce(async () => member);
      spyOnServiceGetMemberConfig.mockImplementationOnce(async () => memberConfig);
      spyOnUserServiceGetUser.mockImplementationOnce(async () => user);
      spyOnNotificationsServiceSend.mockImplementationOnce(async () => undefined);

      const internalNotifyParams = generateInternalNotifyParams({
        type: InternalNotificationType.textToMember,
      });

      await resolver.internalNotify(internalNotifyParams);

      expect(spyOnNotificationsServiceSend).toBeCalledWith({
        sendTwilioNotification: {
          orgName: member.org.name,
          body: internalNotifyParams.content,
          to: member.phone,
        },
      });
    });

    // eslint-disable-next-line max-len
    it('should send SMS notification for textToMember if notification is disabled and add dynamic link to the content', async () => {
      const member = mockGenerateMember();
      const memberConfig = mockGenerateMemberConfig();
      memberConfig.isPushNotificationsEnabled = false;
      const user = mockGenerateUser();
      spyOnServiceGetMember.mockImplementationOnce(async () => member);
      spyOnServiceGetMemberConfig.mockImplementationOnce(async () => memberConfig);
      spyOnUserServiceGetUser.mockImplementationOnce(async () => user);
      spyOnNotificationsServiceSend.mockImplementationOnce(async () => undefined);

      const internalNotifyParams = generateInternalNotifyParams({
        type: InternalNotificationType.textToMember,
      });

      await resolver.internalNotify(internalNotifyParams);

      expect(spyOnNotificationsServiceSend).toBeCalledWith({
        sendTwilioNotification: {
          orgName: member.org.name,
          body: (internalNotifyParams.content += `\n${config.get('hosts.dynamicLink')}`),
          to: member.phone,
        },
      });
    });

    it('should send push notification for textToMember', async () => {
      const member = mockGenerateMember();
      const memberConfig = mockGenerateMemberConfig();
      const user = mockGenerateUser();
      spyOnServiceGetMember.mockImplementationOnce(async () => member);
      spyOnServiceGetMemberConfig.mockImplementationOnce(async () => memberConfig);
      spyOnUserServiceGetUser.mockImplementationOnce(async () => user);
      spyOnNotificationsServiceSend.mockImplementationOnce(async () => undefined);

      const internalNotifyParams = generateInternalNotifyParams({
        type: InternalNotificationType.textToMember,
      });

      await resolver.internalNotify(internalNotifyParams);

      expect(spyOnNotificationsServiceSend).toBeCalledWith({
        sendOneSignalNotification: {
          platform: memberConfig.platform,
          externalUserId: memberConfig.externalUserId,
          data: {
            user: { id: user.id, firstName: user.firstName, avatar: user.avatar },
            member: { phone: member.phone },
            type: InternalNotificationType.textToMember,
            isVideo: false,
          },
          content: internalNotifyParams.content,
          orgName: member.org.name,
        },
      });
    });

    it('should replace chatLink if chatLink in metadata', async () => {
      const member = mockGenerateMember();
      const memberConfig = mockGenerateMemberConfig();
      memberConfig.platform = Platform.web;
      const user = mockGenerateUser();
      spyOnServiceGetMember.mockImplementationOnce(async () => member);
      spyOnServiceGetMemberConfig.mockImplementationOnce(async () => memberConfig);
      spyOnUserServiceGetUser.mockImplementationOnce(async () => user);
      spyOnNotificationsServiceSend.mockImplementationOnce(async () => undefined);

      const internalNotifyParams = generateInternalNotifyParams({
        type: InternalNotificationType.textToMember,
        metadata: { chatLink: 'chatLink' },
        content: 'test',
      });

      await resolver.internalNotify(internalNotifyParams);

      expect(spyOnNotificationsServiceSend).toBeCalledWith({
        sendTwilioNotification: {
          body:
            'test' +
            internationalizationService.getContents({
              member,
              user,
              extraData: { chatLink: 'chatLink' },
              contentType: ContentKey.appointmentReminderLink,
              language: Language.en,
            }),
          to: member.phone,
          orgName: member.org.name,
        },
      });
    });

    it('should replace scheduleLink if scheduleLink in metadata', async () => {
      const member = mockGenerateMember();
      const memberConfig = mockGenerateMemberConfig();
      memberConfig.platform = Platform.web;
      const user = mockGenerateUser();
      spyOnServiceGetMember.mockImplementationOnce(async () => member);
      spyOnServiceGetMemberConfig.mockImplementationOnce(async () => memberConfig);
      spyOnUserServiceGetUser.mockImplementationOnce(async () => user);
      spyOnNotificationsServiceSend.mockImplementationOnce(async () => undefined);

      const internalNotifyParams = generateInternalNotifyParams({
        type: InternalNotificationType.textToMember,
        metadata: { scheduleLink: 'scheduleLink' },
        content: 'test',
      });

      await resolver.internalNotify(internalNotifyParams);

      expect(spyOnNotificationsServiceSend).toBeCalledWith({
        sendTwilioNotification: {
          body:
            'test' +
            internationalizationService.getContents({
              member,
              user,
              extraData: { scheduleLink: 'scheduleLink' },
              contentType: ContentKey.appointmentRequestLink,
              language: Language.en,
            }),
          to: member.phone,
          orgName: member.org.name,
        },
      });
    });

    it('should send notification in spanish if member language = es', async () => {
      const member = mockGenerateMember();
      member.language = Language.es;
      const memberConfig = mockGenerateMemberConfig();
      memberConfig.platform = Platform.web;
      const user = mockGenerateUser();
      spyOnServiceGetMember.mockImplementationOnce(async () => member);
      spyOnServiceGetMemberConfig.mockImplementationOnce(async () => memberConfig);
      spyOnUserServiceGetUser.mockImplementationOnce(async () => user);
      spyOnNotificationsServiceSend.mockImplementationOnce(async () => undefined);

      const internalNotifyParams = generateInternalNotifyParams({
        type: InternalNotificationType.textToMember,
        metadata: { contentType: ContentKey.newMember },
      });

      await resolver.internalNotify(internalNotifyParams);

      expect(spyOnNotificationsServiceSend).toBeCalledWith({
        sendTwilioNotification: {
          body: internationalizationService.getContents({
            member,
            user,
            contentType: ContentKey.newMember,
            language: Language.es,
          }),
          to: member.phone,
          orgName: member.org.name,
        },
      });
    });

    it('should send push notification for chatMessageToMember', async () => {
      const member = mockGenerateMember();
      const memberConfig = mockGenerateMemberConfig();
      const user = mockGenerateUser();
      spyOnServiceGetMember.mockImplementationOnce(async () => member);
      spyOnServiceGetMemberConfig.mockImplementationOnce(async () => memberConfig);
      spyOnUserServiceGetUser.mockImplementationOnce(async () => user);
      spyOnNotificationsServiceSend.mockImplementationOnce(async () => undefined);

      const internalNotifyParams = generateInternalNotifyParams({
        type: InternalNotificationType.chatMessageToMember,
      });

      await resolver.internalNotify(internalNotifyParams);

      expect(spyOnNotificationsServiceSend).toBeCalledWith({
        sendOneSignalNotification: {
          platform: memberConfig.platform,
          externalUserId: memberConfig.externalUserId,
          data: {
            user: { id: user.id, firstName: user.firstName, avatar: user.avatar },
            member: { phone: member.phone },
            type: InternalNotificationType.chatMessageToMember,
            isVideo: false,
            path: `connect/${member.id}/${user.id}`,
          },
          content: internalNotifyParams.content,
          orgName: member.org.name,
        },
      });
    });

    it('should NOT send push notification for chatMessageToMember if platform web', async () => {
      const member = mockGenerateMember();
      const memberConfig = mockGenerateMemberConfig();
      memberConfig.platform = Platform.web;
      const user = mockGenerateUser();
      spyOnServiceGetMember.mockImplementationOnce(async () => member);
      spyOnServiceGetMemberConfig.mockImplementationOnce(async () => memberConfig);
      spyOnUserServiceGetUser.mockImplementationOnce(async () => user);
      spyOnNotificationsServiceSend.mockImplementationOnce(async () => undefined);

      const internalNotifyParams = generateInternalNotifyParams({
        type: InternalNotificationType.chatMessageToMember,
      });

      await resolver.internalNotify(internalNotifyParams);

      expect(spyOnNotificationsServiceSend).not.toBeCalled();
    });

    /* eslint-disable-next-line max-len */
    it('should NOT send push notification for chatMessageToMember if notification is disabled', async () => {
      const member = mockGenerateMember();
      const memberConfig = mockGenerateMemberConfig();
      memberConfig.isPushNotificationsEnabled = false;
      const user = mockGenerateUser();
      spyOnServiceGetMember.mockImplementationOnce(async () => member);
      spyOnServiceGetMemberConfig.mockImplementationOnce(async () => memberConfig);
      spyOnUserServiceGetUser.mockImplementationOnce(async () => user);
      spyOnNotificationsServiceSend.mockImplementationOnce(async () => undefined);

      const internalNotifyParams = generateInternalNotifyParams({
        type: InternalNotificationType.chatMessageToMember,
      });

      await resolver.internalNotify(internalNotifyParams);

      expect(spyOnNotificationsServiceSend).not.toBeCalled();
    });

    it('should send sendBird message for chatMessageToUser', async () => {
      const member = mockGenerateMember();
      const memberConfig = mockGenerateMemberConfig();
      memberConfig.isPushNotificationsEnabled = false;
      const user = mockGenerateUser();
      spyOnServiceGetMember.mockImplementationOnce(async () => member);
      spyOnServiceGetMemberConfig.mockImplementationOnce(async () => memberConfig);
      spyOnUserServiceGetUser.mockImplementationOnce(async () => user);
      spyOnNotificationsServiceSend.mockImplementationOnce(async () => undefined);

      const internalNotifyParams = generateInternalNotifyParams({
        type: InternalNotificationType.chatMessageToUser,
      });

      await resolver.internalNotify(internalNotifyParams);

      expect(spyOnNotificationsServiceSend).toBeCalledWith({
        sendSendBirdNotification: {
          userId: member.id,
          sendBirdChannelUrl: internalNotifyParams.metadata.sendBirdChannelUrl,
          message: internalNotifyParams.content,
          notificationType: InternalNotificationType.chatMessageToUser,
          orgName: member.org.name,
        },
      });
    });
  });

  describe('notifyChatMessage', () => {
    let spyOnServiceGetMember;
    let spyOnServiceGetMemberConfig;
    let spyOnUserServiceGetUser;
    let spyOnNotificationsServiceSend;
    let spyOnCommunicationGetByUrl;

    beforeEach(() => {
      spyOnServiceGetMember = jest.spyOn(service, 'get');
      spyOnServiceGetMemberConfig = jest.spyOn(service, 'getMemberConfig');
      spyOnUserServiceGetUser = jest.spyOn(userService, 'get');
      spyOnNotificationsServiceSend = jest.spyOn(notificationsService, 'send');
      spyOnCommunicationGetByUrl = jest.spyOn(communicationService, 'getByChannelUrl');
    });

    afterEach(() => {
      spyOnServiceGetMember.mockReset();
      spyOnServiceGetMemberConfig.mockReset();
      spyOnUserServiceGetUser.mockReset();
      spyOnNotificationsServiceSend.mockReset();
      spyOnCommunicationGetByUrl.mockReset();
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

      expect(spyOnCreateDispatch).toBeCalledWith({
        dispatchId: expect.stringContaining(generateDispatchId(ContentKey.newChatMessageFromUser)),
        memberId: communication.memberId.toString(),
        userId: user.id,
        type: InternalNotificationType.chatMessageToMember,
        correlationId: expect.any(String),
        metadata: { contentType: ContentKey.newChatMessageFromUser },
      });
    });

    it('should notify the coach on chat message sent from member - coach is offline', async () => {
      const member = mockGenerateMember();
      const user = mockGenerateUser();
      const communication: Communication = {
        memberId: new Types.ObjectId(member.id),
        userId: new Types.ObjectId(user.id),
        sendBirdChannelUrl: generateUniqueUrl(),
      };
      spyOnServiceGetMember.mockImplementation(async () => member);
      spyOnUserServiceGetUser.mockImplementation(async (userId: string) => {
        if (userId === user.id) {
          return user;
        }
        return undefined;
      });

      spyOnCommunicationGetByUrl.mockImplementation(async () => communication);
      const spyOnCreateDispatch = jest.spyOn(resolver, 'notifyCreateDispatch');
      const params: IEventOnReceivedChatMessage = {
        senderUserId: member.id,
        sendBirdChannelUrl: communication.sendBirdChannelUrl,
        sendBirdMemberInfo: [
          { memberId: member.id, isOnline: true },
          { memberId: user.id, isOnline: false },
        ],
      };

      await resolver.notifyChatMessage(params);

      expect(spyOnCreateDispatch).toBeCalledWith({
        dispatchId: expect.stringContaining(
          generateDispatchId(ContentKey.newChatMessageFromMember),
        ),
        memberId: member.id,
        userId: communication.userId.toString(),
        type: InternalNotificationType.textSmsToUser,
        correlationId: expect.any(String),
        metadata: { contentType: ContentKey.newChatMessageFromMember },
      });
    }, 10000);

    /* eslint-disable-next-line max-len */
    it('should not notify the coach on chat message sent from member - coach is online', async () => {
      const member = mockGenerateMember();
      const user = mockGenerateUser();
      const communication: Communication = {
        memberId: new Types.ObjectId(member.id),
        userId: new Types.ObjectId(user.id),
        sendBirdChannelUrl: generateUniqueUrl(),
      };
      spyOnServiceGetMember.mockImplementation(async () => member);
      spyOnUserServiceGetUser.mockImplementation(async (userId: string) => {
        if (userId === user.id) {
          return user;
        }
        return undefined;
      });

      spyOnCommunicationGetByUrl.mockImplementation(async () => communication);
      const params: IEventOnReceivedChatMessage = {
        senderUserId: member.id,
        sendBirdChannelUrl: communication.sendBirdChannelUrl,
        sendBirdMemberInfo: [
          { memberId: member.id, isOnline: true },
          { memberId: user.id, isOnline: true },
        ],
      };

      await resolver.notifyChatMessage(params);

      expect(spyOnNotificationsServiceSend).not.toBeCalled();
    });

    const fakeData: IEventOnReceivedChatMessage = {
      senderUserId: v4(),
      sendBirdChannelUrl: generateUniqueUrl(),
    };

    /* eslint-disable-next-line max-len */
    it('should disregard notify chat message when sent from member and member does not exist', async () => {
      spyOnUserServiceGetUser.mockImplementation(async () => undefined);
      spyOnServiceGetMember.mockImplementation(async () => undefined);

      await resolver.notifyChatMessage(fakeData);

      expect(spyOnNotificationsServiceSend).not.toBeCalled();
    });

    it('should disregard notify on non existing sendBirdChannelUrl', async () => {
      spyOnUserServiceGetUser.mockImplementation(async () => mockGenerateUser());
      spyOnCommunicationGetByUrl.mockImplementation(async () => undefined);

      await resolver.notifyChatMessage(fakeData);

      expect(spyOnNotificationsServiceSend).not.toBeCalled();
    });
  });
});
