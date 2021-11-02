import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import * as config from 'config';
import * as faker from 'faker';
import { capitalize } from 'lodash';
import { Types } from 'mongoose';
import { v4 } from 'uuid';
import {
  CancelNotificationType,
  ErrorType,
  Errors,
  EventType,
  IEventNewMember,
  IEventNotifyChatMessage,
  IEventRequestAppointment,
  IEventSlackMessage,
  IEventUpdateMemberPlatform,
  InternalNotificationType,
  NotificationType,
  Platform,
  RegisterForNotificationParams,
  SlackChannel,
  SlackIcon,
  StorageType,
} from '../../src/common';
import {
  Communication,
  CommunicationResolver,
  CommunicationService,
} from '../../src/communication';
import {
  Member,
  MemberConfig,
  MemberModule,
  MemberResolver,
  MemberScheduler,
  MemberService,
  TaskStatus,
} from '../../src/member';
import { CognitoService, NotificationsService, StorageService } from '../../src/providers';
import { UserService } from '../../src/user';
import {
  dbDisconnect,
  defaultModules,
  delay,
  generateAppointmentComposeParams,
  generateCancelNotifyParams,
  generateCommunication,
  generateCreateMemberParams,
  generateCreateTaskParams,
  generateGetCommunication,
  generateId,
  generateInternalNotifyParams,
  generateNotifyParams,
  generateSetGeneralNotesParams,
  generateUniqueUrl,
  generateUpdateMemberConfigParams,
  generateUpdateMemberParams,
  generateUpdateRecordingParams,
  generateUpdateTaskStatusParams,
  mockGenerateMember,
  mockGenerateMemberConfig,
  mockGenerateUser,
} from '../index';

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
    let spyOnServiceGetAvailableUser;
    let spyOnUserServiceGetUser;
    let spyOnServiceGetMemberConfig;

    beforeEach(() => {
      spyOnServiceInsert = jest.spyOn(service, 'insert');
      spyOnServiceGetAvailableUser = jest.spyOn(userService, 'getAvailableUser');
      spyOnUserServiceGetUser = jest.spyOn(userService, 'get');
      spyOnServiceGetMemberConfig = jest.spyOn(service, 'getMemberConfig');
    });

    afterEach(() => {
      spyOnServiceInsert.mockReset();
      spyOnServiceGetAvailableUser.mockReset();
      spyOnUserServiceGetUser.mockReset();
      spyOnServiceGetMemberConfig.mockReset();
      spyOnEventEmitter.mockReset();
    });

    it('should create a member', async () => {
      const member = mockGenerateMember();
      const user = mockGenerateUser();
      const memberConfig = {
        memberId: member.id,
        userId: member.primaryUserId,
        platform: Platform.android,
      };
      spyOnServiceInsert.mockImplementationOnce(async () => member);
      spyOnServiceGetMemberConfig.mockImplementationOnce(async () => memberConfig);
      spyOnServiceGetAvailableUser.mockImplementationOnce(async () => member.primaryUserId);
      spyOnUserServiceGetUser.mockImplementationOnce(async () => user);

      const params = generateCreateMemberParams({ orgId: generateId() });
      await resolver.createMember(params);

      expect(spyOnServiceInsert).toBeCalledTimes(1);
      expect(spyOnServiceInsert).toBeCalledWith(params, member.primaryUserId);
      expect(spyOnServiceGetAvailableUser).toBeCalledTimes(1);
      expect(spyOnServiceGetMemberConfig).toBeCalledTimes(1);
      expect(spyOnServiceGetMemberConfig).toBeCalledWith(member.id);
      const eventNewMemberParams: IEventNewMember = {
        member,
        user,
        platform: memberConfig.platform,
      };
      expect(spyOnEventEmitter).toBeCalledWith(EventType.newMember, eventNewMemberParams);
      const eventRequestAppointmentParams: IEventRequestAppointment = {
        member,
        user,
      };
      expect(spyOnEventEmitter).toBeCalledWith(
        EventType.requestAppointment,
        eventRequestAppointmentParams,
      );
      const eventSlackMessageParams: IEventSlackMessage = {
        // eslint-disable-next-line max-len
        message: `*New customer*\n${member.firstName} [${member.id}],\nassigned to ${user.firstName}.`,
        icon: SlackIcon.info,
        channel: SlackChannel.support,
      };
      expect(spyOnEventEmitter).toBeCalledWith(EventType.slackMessage, eventSlackMessageParams);
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
    let spyOnServiceGetByDeviceId;
    let spyOnServiceGet;
    beforeEach(() => {
      spyOnServiceGetByDeviceId = jest.spyOn(service, 'getByDeviceId');
      spyOnServiceGet = jest.spyOn(service, 'get');
    });

    afterEach(() => {
      spyOnServiceGetByDeviceId.mockReset();
      spyOnServiceGet.mockReset();
    });

    it('should get a member for a given context', async () => {
      const member = mockGenerateMember();
      spyOnServiceGetByDeviceId.mockImplementationOnce(async () => member);

      const result = await resolver.getMember({
        req: {
          headers: {
            /* eslint-disable max-len */
            authorization: `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6InRlc3QifQ.hNQI_r8BATy1LyXPr6Zuo9X_V0kSED8ngcqQ6G-WV5w`,
            /* eslint-enable max-len */
          },
        },
      });

      expect(result).toEqual(member);
    });

    it('should get a member for a given id', async () => {
      const member = mockGenerateMember();
      spyOnServiceGet.mockImplementationOnce(async () => member);

      const result = await resolver.getMember({}, member.id);
      expect(result).toEqual(member);
    });

    it('should throw exception on a non valid member', async () => {
      spyOnServiceGet.mockImplementationOnce(async () => {
        throw Error(Errors.get(ErrorType.memberNotFound));
      });

      await expect(resolver.getMember({}, generateId())).rejects.toThrow(
        Errors.get(ErrorType.memberNotFound),
      );
    });

    it('should throw exception on a non valid member', async () => {
      spyOnServiceGetByDeviceId.mockImplementationOnce(async () => null);

      await expect(
        resolver.getMember({
          req: { headers: { authorization: 'not-valid' } },
        }),
      ).rejects.toThrow(Errors.get(ErrorType.memberNotFound));
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
      const id = generateId();
      const member = mockGenerateMember();
      const memberConfig = mockGenerateMemberConfig();
      spyOnServiceMoveMemberToArchive.mockImplementationOnce(async () => ({
        member,
        memberConfig,
      }));
      spyOnCognitoServiceDisableMember.mockImplementationOnce(() => undefined);
      spyOnCommunicationFreezeGroupChannel.mockImplementationOnce(() => undefined);
      spyOnNotificationsServiceUnregister.mockImplementationOnce(() => undefined);

      await resolver.archiveMember(id);

      expect(spyOnServiceMoveMemberToArchive).toBeCalledWith(id);
      expect(spyOnCognitoServiceDisableMember).toBeCalledWith(member.deviceId);
      expect(spyOnCommunicationFreezeGroupChannel).toBeCalledWith({
        memberId: id,
        userId: member.primaryUserId,
      });
      expect(spyOnNotificationsServiceUnregister).toBeCalledWith(memberConfig);
      expect(spyOnEventEmitter).toBeCalledWith(EventType.deleteSchedules, { memberId: id });
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
      spyOnUserServiceRemoveAppointmentsFromUser = jest.spyOn(
        userService,
        'removeAppointmentsFromUser',
      );
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

    it('', async () => {
      const id = generateId();
      const member = mockGenerateMember();
      const memberConfig = mockGenerateMemberConfig();
      const appointments = [generateAppointmentComposeParams(), generateAppointmentComposeParams()];
      const communication = generateCommunication({
        memberId: new Types.ObjectId(id),
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

      await resolver.deleteMember(id);

      expect(spyOnCommunicationDeleteCommunication).toBeCalledWith(communication);
      expect(spyOnNotificationsServiceUnregister).toBeCalledWith(memberConfig);
      expect(spyOnCognitoServiceDeleteMember).toBeCalledWith(member.deviceId);
      expect(spyOnStorageServiceDeleteMember).toBeCalledWith(id);
      expect(spyOnEventEmitter).toBeCalledWith(EventType.deleteMember, id);
      expect(spyOnEventEmitter).toBeCalledWith(EventType.deleteSchedules, { memberId: id });
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

    it('should get a member download discharge documents links for a given context', async () => {
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
    let spyOnServiceGetMember;

    beforeEach(() => {
      spyOnServiceUpdateConfig = jest.spyOn(service, 'updateMemberConfig');
      spyOnServiceGetMember = jest.spyOn(service, 'get');
    });

    afterEach(() => {
      spyOnServiceUpdateConfig.mockReset();
      spyOnServiceGetMember.mockReset();
      spyOnServiceGetMember.mockRestore();
    });

    it('should update a member config', async () => {
      const updateMemberConfigParams = generateUpdateMemberConfigParams();
      spyOnServiceUpdateConfig.mockImplementationOnce(async () => true);
      spyOnServiceGetMember.mockImplementationOnce(async () => mockGenerateMember());

      await resolver.updateMemberConfig(updateMemberConfigParams);

      expect(spyOnServiceUpdateConfig).toBeCalledTimes(1);
      expect(spyOnServiceUpdateConfig).toBeCalledWith(updateMemberConfigParams);
    });

    it('should not update member config on non existing member', async () => {
      await expect(resolver.updateMemberConfig(generateUpdateMemberConfigParams())).rejects.toThrow(
        Errors.get(ErrorType.memberNotFound),
      );
    });
  });

  describe('registerMemberForNotifications', () => {
    let spyOnNotificationsServiceRegister;
    let spyOnServiceGetMember;
    let spyOnServiceGetMemberConfig;
    let spyOnServiceUpdateMemberConfig;
    let spyOnServiceUpdateMemberConfigRegisteredAt;
    let spyOnSchedulerDeleteTimeout;
    let spyOnSchedulerNewRegisteredMember;

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
      spyOnSchedulerNewRegisteredMember = jest.spyOn(
        memberScheduler,
        'registerNewRegisteredMemberNotify',
      );
    });

    afterEach(() => {
      spyOnNotificationsServiceRegister.mockReset();
      spyOnServiceGetMember.mockReset();
      spyOnServiceGetMemberConfig.mockReset();
      spyOnServiceUpdateMemberConfig.mockReset();
      spyOnServiceUpdateMemberConfigRegisteredAt.mockReset();
      spyOnSchedulerDeleteTimeout.mockReset();
      spyOnSchedulerNewRegisteredMember.mockReset();
    });

    it('should not call notificationsService on platform=android', async () => {
      spyOnNotificationsServiceRegister.mockImplementationOnce(async () => undefined);
      const memberConfig = mockGenerateMemberConfig();
      delete memberConfig.firstLoggedInAt;
      const member = mockGenerateMember();
      member.id = memberConfig.memberId.toString();

      spyOnServiceGetMember.mockImplementationOnce(async () => member);
      spyOnServiceGetMemberConfig.mockImplementationOnce(async () => memberConfig);
      spyOnServiceUpdateMemberConfig.mockImplementationOnce(async () => true);

      const params: RegisterForNotificationParams = {
        memberId: member.id,
        platform: Platform.android,
        isPushNotificationsEnabled: true,
      };
      await resolver.registerMemberForNotifications(params);

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
      expect(spyOnSchedulerDeleteTimeout).toBeCalledWith({ id: member.id });
      expect(spyOnSchedulerNewRegisteredMember).toBeCalledWith({
        memberId: member.id,
        userId: member.primaryUserId,
        firstLoggedInAt: expect.any(Date),
      });
    });

    it('should call notificationsService on platform=ios', async () => {
      spyOnNotificationsServiceRegister.mockImplementationOnce(async () => undefined);
      const memberConfig = mockGenerateMemberConfig();
      delete memberConfig.firstLoggedInAt;
      const member = mockGenerateMember();
      member.id = memberConfig.memberId.toString();

      spyOnServiceGetMemberConfig.mockImplementationOnce(async () => memberConfig);
      spyOnServiceGetMember.mockImplementationOnce(async () => member);

      const params: RegisterForNotificationParams = {
        memberId: member.id,
        platform: Platform.ios,
        isPushNotificationsEnabled: memberConfig.isPushNotificationsEnabled,
        token: faker.lorem.word(),
      };
      await resolver.registerMemberForNotifications(params);

      expect(spyOnNotificationsServiceRegister).toBeCalledTimes(1);
      expect(spyOnNotificationsServiceRegister).toBeCalledWith({
        token: params.token,
        externalUserId: memberConfig.externalUserId,
      });
      expect(spyOnServiceUpdateMemberConfig).toBeCalledTimes(1);
      expect(spyOnServiceUpdateMemberConfig).toBeCalledWith({
        memberId: member.id,
        platform: params.platform,
        isPushNotificationsEnabled: memberConfig.isPushNotificationsEnabled,
      });
      const eventParams: IEventUpdateMemberPlatform = {
        memberId: params.memberId,
        platform: params.platform,
        userId: member.primaryUserId,
      };
      expect(spyOnEventEmitter).toBeCalledWith(EventType.updateMemberPlatform, eventParams);
      expect(spyOnSchedulerDeleteTimeout).toBeCalledWith({ id: member.id });
    });

    it('should not call updateMemberConfigRegisteredAt if firstLoggedInAt exists', async () => {
      const memberConfig = mockGenerateMemberConfig();
      const member = mockGenerateMember();
      member.id = memberConfig.memberId.toString();

      spyOnServiceGetMember.mockImplementationOnce(async () => member);
      spyOnServiceGetMemberConfig.mockImplementationOnce(async () => memberConfig);

      const params: RegisterForNotificationParams = {
        memberId: member.id,
        platform: Platform.android,
        isPushNotificationsEnabled: true,
      };
      await resolver.registerMemberForNotifications(params);

      expect(spyOnServiceUpdateMemberConfigRegisteredAt).not.toBeCalled();
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

  describe('setNewUserToMember', () => {
    let spyOnServiceSetNewUserToMember;
    let spyOnUserServiceGet;

    beforeEach(() => {
      spyOnUserServiceGet = jest.spyOn(userService, 'get');
      spyOnServiceSetNewUserToMember = jest.spyOn(service, 'setNewUserToMember');
    });

    afterEach(() => {
      spyOnServiceSetNewUserToMember.mockReset();
      spyOnUserServiceGet.mockReset();
      spyOnEventEmitter.mockReset();
    });

    it('should set new user for a given member', async () => {
      const memberId = generateId();
      const user = mockGenerateUser();
      const oldUserId = generateId();
      spyOnUserServiceGet.mockImplementationOnce(async () => user);
      spyOnServiceSetNewUserToMember.mockImplementationOnce(async () => oldUserId);

      await resolver.setNewUserToMember({ memberId, userId: user.id });

      expect(spyOnUserServiceGet).toBeCalledWith(user.id);
      expect(spyOnServiceSetNewUserToMember).toBeCalledWith({ memberId, userId: user.id });
      expect(spyOnEventEmitter).toBeCalledWith(EventType.updateUserInCommunication, {
        newUser: user,
        oldUserId,
        memberId,
      });
    });

    it("should throw an error when the new user doesn't exist", async () => {
      const memberId = generateId();
      const user = mockGenerateUser();
      spyOnUserServiceGet.mockImplementationOnce(async () => null);

      await expect(resolver.setNewUserToMember({ memberId, userId: user.id })).rejects.toThrow(
        Errors.get(ErrorType.userNotFound),
      );
    });
  });

  describe('notify', () => {
    let spyOnServiceGetMember;
    let spyOnServiceGetMemberConfig;
    let spyOnUserServiceGetUser;
    let spyOnNotificationsServiceSend;
    let spyOnNotificationsServiceCancel;
    let spyOnCommunicationResolverGetCommunication;
    let spyOnCommunicationServiceGet;

    beforeEach(() => {
      spyOnServiceGetMember = jest.spyOn(service, 'get');
      spyOnServiceGetMemberConfig = jest.spyOn(service, 'getMemberConfig');
      spyOnUserServiceGetUser = jest.spyOn(userService, 'get');
      spyOnNotificationsServiceSend = jest.spyOn(notificationsService, 'send');
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

    it('should replace content in metadata', async () => {
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
        metadata: { content: '@member.honorific@ @member.lastName@ @user.firstName@' },
      });

      await resolver.notify(notifyParams);

      expect(spyOnNotificationsServiceSend).toBeCalledWith({
        sendTwilioNotification: {
          body: `${config.get(`contents.honorific.${member.honorific}`)} ${member.lastName} ${
            user.firstName
          }`,
          to: member.phone,
          orgName: member.org.name,
        },
      });
    });

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

        const notifyParams = generateNotifyParams({
          type,
        });

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
            },
            metadata: notifyParams.metadata,
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
        userId: member.primaryUserId,
        type: NotificationType.text,
        metadata: { content: faker.lorem.word(), when },
      });

      await resolver.notify(notifyParams);

      await delay(300);
      delete notifyParams.metadata.when;
      expect(spyOnEventEmitter).toBeCalledWith(EventType.internalNotify, {
        memberId: member.id,
        userId: member.primaryUserId,
        type:
          notifyParams.type === NotificationType.text
            ? InternalNotificationType.textToMember
            : InternalNotificationType.textSmsToMember,
        metadata: { content: notifyParams.metadata.content },
      });
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
        userId: member.primaryUserId,
        type: NotificationType.text,
        metadata: { content: faker.lorem.word(), chatLink: true },
      });

      await resolver.notify(notifyParams);

      expect(spyOnCommunicationResolverGetCommunication).toBeCalledWith({
        memberId: member.id,
        userId: member.primaryUserId,
      });
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
          orgName: params.isMember ? member.org.name : undefined,
          body: internalNotifyParams.metadata.content,
          to: params.isMember ? member.phone : user.phone,
        },
      });
    });

    it('should send SMS notification for textToMember if platform web', async () => {
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
          body: internalNotifyParams.metadata.content,
          to: member.phone,
        },
      });
    });

    it('should send SMS notification for textToMember if notification is disabled', async () => {
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
          body: internalNotifyParams.metadata.content,
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
          metadata: internalNotifyParams.metadata,
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
        metadata: { content: 'test', chatLink: 'chatLink' },
      });

      await resolver.internalNotify(internalNotifyParams);

      expect(spyOnNotificationsServiceSend).toBeCalledWith({
        sendTwilioNotification: {
          body: `test${config
            .get('contents.appointmentReminderChatLink')
            .replace('@chatLink@', internalNotifyParams.metadata.chatLink)}`,
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
          metadata: internalNotifyParams.metadata,
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

    // eslint-disable-next-line max-len
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
          message: internalNotifyParams.metadata.content,
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
    let spyOnCommunicationGetUnreadMessageCount;

    beforeEach(() => {
      spyOnServiceGetMember = jest.spyOn(service, 'get');
      spyOnServiceGetMemberConfig = jest.spyOn(service, 'getMemberConfig');
      spyOnUserServiceGetUser = jest.spyOn(userService, 'get');
      spyOnNotificationsServiceSend = jest.spyOn(notificationsService, 'send');
      spyOnCommunicationGetByUrl = jest.spyOn(communicationService, 'getByChannelUrl');
      spyOnCommunicationGetUnreadMessageCount = jest.spyOn(
        communicationService,
        'getParticipantUnreadMessagesCount',
      );
    });

    afterEach(() => {
      spyOnServiceGetMember.mockReset();
      spyOnServiceGetMemberConfig.mockReset();
      spyOnUserServiceGetUser.mockReset();
      spyOnNotificationsServiceSend.mockReset();
      spyOnCommunicationGetByUrl.mockReset();
      spyOnCommunicationGetUnreadMessageCount.mockReset();
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
        userId: user.id,
        sendBirdChannelUrl: generateUniqueUrl(),
      };
      spyOnServiceGetMemberConfig.mockImplementationOnce(async () => memberConfig);
      spyOnServiceGetMember.mockImplementationOnce(async () => member);
      spyOnUserServiceGetUser.mockImplementation(async () => user);
      spyOnCommunicationGetByUrl.mockImplementation(async () => communication);

      const params: IEventNotifyChatMessage = {
        senderUserId: user.id,
        sendBirdChannelUrl: communication.sendBirdChannelUrl,
      };

      await resolver.notifyChatMessage(params);

      expect(spyOnNotificationsServiceSend).toBeCalledWith({
        sendOneSignalNotification: {
          externalUserId: memberConfig.externalUserId,
          platform: memberConfig.platform,
          data: {
            user: {
              id: user.id,
              firstName: user.firstName,
              avatar: user.avatar,
            },
            member: { phone: member.phone },
            type: InternalNotificationType.chatMessageToMember,
            isVideo: false,
            path: `connect/${member.id}/${user.id}`,
          },
          metadata: {
            content: config
              .get('contents.newChatMessageFromUser')
              .replace('@user.firstName@', user.firstName),
          },
          orgName: member.org.name,
        },
      });
    });

    it('should handle notify chat message sent from member with unread messages', async () => {
      const member = mockGenerateMember();
      const user = mockGenerateUser();
      const communication: Communication = {
        memberId: new Types.ObjectId(member.id),
        userId: user.id,
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
      spyOnCommunicationGetUnreadMessageCount.mockImplementation(async () => ({
        count: 1,
      }));
      const params: IEventNotifyChatMessage = {
        senderUserId: member.id,
        sendBirdChannelUrl: communication.sendBirdChannelUrl,
      };

      await resolver.notifyChatMessage(params);

      expect(spyOnNotificationsServiceSend).toBeCalledWith({
        sendTwilioNotification: {
          body: config
            .get('contents.newChatMessageFromMember')
            .replace('@member.honorific@', config.get(`contents.honorific.${member.honorific}`))
            .replace('@member.lastName@', capitalize(member.lastName)),
          to: user.phone,
        },
      });
    });

    it('should not notify user on chat message from member - no unread messages', async () => {
      const member = mockGenerateMember();
      const user = mockGenerateUser();
      const communication: Communication = {
        memberId: new Types.ObjectId(member.id),
        userId: user.id,
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
      spyOnCommunicationGetUnreadMessageCount.mockImplementation(async () => ({
        count: 0,
      }));
      const params: IEventNotifyChatMessage = {
        senderUserId: member.id,
        sendBirdChannelUrl: communication.sendBirdChannelUrl,
      };

      await resolver.notifyChatMessage(params);

      expect(spyOnNotificationsServiceSend).not.toBeCalled();
    });

    const fakeData: IEventNotifyChatMessage = {
      senderUserId: v4(),
      sendBirdChannelUrl: generateUniqueUrl(),
    };

    // eslint-disable-next-line max-len
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

    it('should disregard notify on non existing sendBirdChannelUrl', async () => {
      spyOnUserServiceGetUser.mockImplementation(async () => mockGenerateUser());
      spyOnCommunicationGetByUrl.mockImplementation(async () => undefined);

      await resolver.notifyChatMessage(fakeData);

      expect(spyOnNotificationsServiceSend).not.toBeCalled();
    });
  });
});
