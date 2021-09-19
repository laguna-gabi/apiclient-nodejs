import { Test, TestingModule } from '@nestjs/testing';
import {
  dbDisconnect,
  generateAppointmentComposeParams,
  generateCreateMemberParams,
  generateCreateTaskParams,
  generateId,
  generateNotifyParams,
  generatePath,
  generateSetGeneralNotesParams,
  generateUpdateMemberParams,
  generateUpdateTaskStatusParams,
  mockGenerateMember,
  mockGenerateMemberConfig,
  mockGenerateUser,
  generateCancelNotifyParams,
} from '../index';
import { DbModule } from '../../src/db/db.module';
import { MemberModule, MemberResolver, MemberService, TaskStatus } from '../../src/member';
import { EventEmitter2, EventEmitterModule } from '@nestjs/event-emitter';
import {
  CancelNotificationType,
  Errors,
  ErrorType,
  EventType,
  IEventNewMember,
  IEventUpdateMemberPlatform,
  NotificationType,
  Platform,
  RegisterForNotificationParams,
} from '../../src/common';
import { NotificationsService, StorageService } from '../../src/providers';
import * as faker from 'faker';
import { UserService } from '../../src/user';
import { Types } from 'mongoose';
import * as config from 'config';
import { v4 } from 'uuid';

describe('MemberResolver', () => {
  let module: TestingModule;
  let resolver: MemberResolver;
  let service: MemberService;
  let userService: UserService;
  let storage: StorageService;
  let notificationsService: NotificationsService;
  let eventEmitter: EventEmitter2;
  let spyOnEventEmitter;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [DbModule, MemberModule, EventEmitterModule.forRoot()],
    }).compile();

    resolver = module.get<MemberResolver>(MemberResolver);
    service = module.get<MemberService>(MemberService);
    userService = module.get<UserService>(UserService);
    storage = module.get<StorageService>(StorageService);
    notificationsService = module.get<NotificationsService>(NotificationsService);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
    spyOnEventEmitter = jest.spyOn(eventEmitter, 'emit');
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
    let spyOnUserServiceGetRegisteredUsers;
    let spyOnUserServiceGetUser;
    let spyOnServiceGetMemberConfig;

    beforeEach(() => {
      spyOnServiceInsert = jest.spyOn(service, 'insert');
      spyOnServiceGetAvailableUser = jest.spyOn(service, 'getAvailableUser');
      spyOnUserServiceGetRegisteredUsers = jest.spyOn(userService, 'getRegisteredUsers');
      spyOnUserServiceGetUser = jest.spyOn(userService, 'get');
      spyOnServiceGetMemberConfig = jest.spyOn(service, 'getMemberConfig');
    });

    afterEach(() => {
      spyOnServiceInsert.mockReset();
      spyOnServiceGetAvailableUser.mockReset();
      spyOnUserServiceGetRegisteredUsers.mockReset();
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
      spyOnUserServiceGetRegisteredUsers.mockImplementationOnce(async () => [member.primaryUserId]);
      spyOnUserServiceGetUser.mockImplementationOnce(async () => user);

      const params = generateCreateMemberParams({ orgId: generateId() });
      await resolver.createMember(params);

      expect(spyOnServiceInsert).toBeCalledTimes(1);
      expect(spyOnServiceInsert).toBeCalledWith(params, member.primaryUserId);
      expect(spyOnServiceGetAvailableUser).toBeCalledTimes(1);
      expect(spyOnServiceGetAvailableUser).toBeCalledWith([member.primaryUserId]);
      expect(spyOnUserServiceGetRegisteredUsers).toBeCalledTimes(1);
      expect(spyOnServiceGetMemberConfig).toBeCalledTimes(1);
      expect(spyOnServiceGetMemberConfig).toBeCalledWith(member.id);
      const eventParams: IEventNewMember = {
        member,
        user,
        platform: memberConfig.platform,
      };
      expect(spyOnEventEmitter).toBeCalledWith(EventType.newMember, eventParams);
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

  describe('getMemberDischargeDocumentsLinks', () => {
    let spyOnServiceGet;
    let spyOnStorage;
    beforeEach(() => {
      spyOnServiceGet = jest.spyOn(service, 'get');
      spyOnStorage = jest.spyOn(storage, 'getUrl');
    });

    afterEach(() => {
      spyOnServiceGet.mockReset();
      spyOnStorage.mockReset();
    });

    it('should get a member discharge documents links for a given context', async () => {
      const member = mockGenerateMember();
      spyOnServiceGet.mockImplementationOnce(async () => member);
      spyOnStorage.mockImplementation(async () => 'https://aws-bucket-path/extras');

      const id = generateId();

      await resolver.getMemberDischargeDocumentsLinks(id);

      const prefix = `${member.firstName}_${member.lastName}`;

      expect(spyOnServiceGet).toBeCalledTimes(1);
      expect(spyOnServiceGet).toBeCalledWith(id);
      expect(spyOnStorage).toBeCalledTimes(2);
      expect(spyOnStorage).toHaveBeenNthCalledWith(1, `${prefix}_Summary.pdf`);
      expect(spyOnStorage).toHaveBeenNthCalledWith(2, `${prefix}_Instructions.pdf`);
    });

    it('should throw exception on a non valid member', async () => {
      spyOnServiceGet.mockImplementationOnce(async () => {
        throw Error(Errors.get(ErrorType.memberNotFound));
      });

      await expect(resolver.getMemberDischargeDocumentsLinks(generateId())).rejects.toThrow(
        Errors.get(ErrorType.memberNotFound),
      );
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

    it('should set general notes', async () => {
      const memberConfig = mockGenerateMemberConfig();
      spyOnServiceGetMemberConfig.mockImplementationOnce(async () => memberConfig);

      await resolver.getMemberConfig(memberConfig.memberId.toString());

      expect(spyOnServiceGetMemberConfig).toBeCalledTimes(1);
      expect(spyOnServiceGetMemberConfig).toBeCalledWith(memberConfig.memberId.toString());
    });
  });

  describe('registerMemberForNotifications', () => {
    let spyOnNotificationsServiceRegister;
    let spyOnServiceGetMember;
    let spyOnServiceGetMemberConfig;
    let spyOnServiceUpdateMemberConfig;

    beforeEach(() => {
      spyOnNotificationsServiceRegister = jest.spyOn(notificationsService, 'register');
      spyOnServiceGetMember = jest.spyOn(service, 'get');
      spyOnServiceGetMemberConfig = jest.spyOn(service, 'getMemberConfig');
      spyOnServiceUpdateMemberConfig = jest.spyOn(service, 'updateMemberConfig');
    });

    afterEach(() => {
      spyOnNotificationsServiceRegister.mockReset();
      spyOnServiceGetMember.mockReset();
      spyOnServiceGetMemberConfig.mockReset();
      spyOnServiceUpdateMemberConfig.mockReset();
    });

    it('should not call notificationsService on platform=android', async () => {
      spyOnNotificationsServiceRegister.mockImplementationOnce(async () => undefined);
      const memberConfig = mockGenerateMemberConfig();
      const member = mockGenerateMember();
      member.id = memberConfig.memberId.toString();

      spyOnServiceGetMember.mockImplementationOnce(async () => member);
      spyOnServiceGetMemberConfig.mockImplementationOnce(async () => memberConfig);
      spyOnServiceUpdateMemberConfig.mockImplementationOnce(async () => true);

      const params: RegisterForNotificationParams = {
        memberId: member.id,
        platform: Platform.android,
      };
      await resolver.registerMemberForNotifications(params);

      expect(spyOnNotificationsServiceRegister).not.toBeCalled();
      expect(spyOnServiceGetMember).toBeCalledTimes(1);
      expect(spyOnServiceGetMember).toBeCalledWith(member.id);
      expect(spyOnServiceUpdateMemberConfig).toBeCalledTimes(1);
      expect(spyOnServiceUpdateMemberConfig).toBeCalledWith({
        memberId: Types.ObjectId(member.id),
        platform: params.platform,
      });
    });

    it('should call notificationsService on platform=ios', async () => {
      spyOnNotificationsServiceRegister.mockImplementationOnce(async () => undefined);
      const memberConfig = mockGenerateMemberConfig();
      const member = mockGenerateMember();
      member.id = memberConfig.memberId.toString();

      spyOnServiceGetMemberConfig.mockImplementationOnce(async () => memberConfig);
      spyOnServiceGetMember.mockImplementationOnce(async () => member);

      const params: RegisterForNotificationParams = {
        memberId: member.id,
        platform: Platform.ios,
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
        memberId: memberConfig.memberId,
        platform: params.platform,
      });
      const eventParams: IEventUpdateMemberPlatform = {
        memberId: params.memberId,
        platform: params.platform,
        userId: member.primaryUserId,
      };
      expect(spyOnEventEmitter).toBeCalledWith(EventType.updateMemberPlatform, eventParams);
    });
  });

  describe('notify', () => {
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

    test.each`
      type                        | isVideo  | metadata
      ${NotificationType.video}   | ${true}  | ${{ peerId: v4() }}
      ${NotificationType.call}    | ${false} | ${{ peerId: v4() }}
      ${NotificationType.text}    | ${false} | ${{ content: 'text' }}
      ${NotificationType.textSms} | ${false} | ${{ content: 'text' }}
    `(`should notify a member`, async (params) => {
      const member = mockGenerateMember();
      const memberConfig = mockGenerateMemberConfig();
      const user = mockGenerateUser();
      spyOnServiceGetMember.mockImplementationOnce(async () => member);
      spyOnServiceGetMemberConfig.mockImplementationOnce(async () => memberConfig);
      spyOnUserServiceGetUser.mockImplementationOnce(async () => user);
      spyOnNotificationsServiceSend.mockImplementationOnce(async () => undefined);

      const notifyParams = generateNotifyParams({ type: params.type, metadata: params.metadata });

      await resolver.notify(notifyParams);

      expect(spyOnNotificationsServiceSend).toBeCalledWith({
        sendNotificationToMemberParams: {
          externalUserId: memberConfig.externalUserId,
          platform: memberConfig.platform,
          data: {
            user: {
              id: user.id,
              firstName: user.firstName,
              avatar: user.avatar,
            },
            member: {
              phone: member.phone,
            },
            type: notifyParams.type,
            peerId: notifyParams.metadata.peerId,
            isVideo: params.isVideo,
            ...generatePath(notifyParams.type),
          },
          metadata: params.metadata,
        },
      });
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

    it('should notify a message', async () => {
      const member = mockGenerateMember();
      const memberConfig = mockGenerateMemberConfig();
      const user = mockGenerateUser();
      spyOnServiceGetMember.mockImplementationOnce(async () => member);
      spyOnServiceGetMemberConfig.mockImplementationOnce(async () => memberConfig);
      spyOnUserServiceGetUser.mockImplementationOnce(async () => user);
      spyOnNotificationsServiceSend.mockImplementationOnce(async () => undefined);

      const notifyParams = generateNotifyParams();

      await resolver.notify(notifyParams);

      expect(spyOnNotificationsServiceSend).toBeCalledWith({
        sendNotificationToMemberParams: {
          externalUserId: memberConfig.externalUserId,
          platform: memberConfig.platform,
          data: {
            user: {
              id: user.id,
              firstName: user.firstName,
              avatar: user.avatar,
            },
            member: {
              phone: member.phone,
            },
            type: notifyParams.type,
            peerId: notifyParams.metadata.peerId,
            isVideo: false,
            ...generatePath(notifyParams.type),
          },
          metadata: notifyParams.metadata,
        },
      });
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

    it('should handle exception locally on calling internal notify(user not found)', async () => {
      const member = mockGenerateMember();
      const memberConfig = mockGenerateMemberConfig();
      spyOnServiceGetMember.mockImplementationOnce(async () => member);
      spyOnServiceGetMemberConfig.mockImplementationOnce(async () => memberConfig);
      spyOnUserServiceGetUser.mockImplementationOnce(async () => undefined);

      await resolver.notifyInternal(generateNotifyParams());
    });

    it('should notify a member via notify.internal with appointment reminder', async () => {
      const member = mockGenerateMember();
      const memberConfig = mockGenerateMemberConfig();
      const user = mockGenerateUser();
      spyOnServiceGetMember.mockImplementationOnce(async () => member);
      spyOnServiceGetMemberConfig.mockImplementationOnce(async () => memberConfig);
      spyOnUserServiceGetUser.mockImplementationOnce(async () => user);
      spyOnNotificationsServiceSend.mockImplementationOnce(async () => undefined);

      const content = `${config
        .get('contents.appointmentReminder')
        .replace('@gapMinutes@', config.get('appointments.alertBeforeInMin'))
        .replace('@chatLink@', faker.internet.url())}`;

      const notifyParams = generateNotifyParams({
        type: NotificationType.text,
        metadata: { content },
      });

      await resolver.notifyInternal(notifyParams);

      expect(notifyParams.metadata.content).toEqual(
        content
          .replace('@member.firstName@', member.firstName)
          .replace('@user.firstName@', user.firstName),
      );

      expect(spyOnNotificationsServiceSend).toBeCalledWith({
        sendNotificationToMemberParams: {
          externalUserId: memberConfig.externalUserId,
          platform: memberConfig.platform,
          data: {
            user: {
              id: user.id,
              firstName: user.firstName,
              avatar: user.avatar,
            },
            member: {
              phone: member.phone,
            },
            type: notifyParams.type,
            peerId: notifyParams.metadata.peerId,
            isVideo: false,
            ...generatePath(notifyParams.type),
          },
          metadata: notifyParams.metadata,
        },
      });
    });

    it('should notify a user via notify.internal with appointment reminder', async () => {
      const user = mockGenerateUser();
      spyOnUserServiceGetUser.mockImplementationOnce(async () => user);
      spyOnNotificationsServiceSend.mockImplementationOnce(async () => undefined);

      const now = new Date();
      const content = `${config
        .get('contents.appointmentUser')
        .replace('@user.firstName@', user.firstName)
        .replace('@appointment.start@', now)}`;

      const notifyParams = generateNotifyParams({
        memberId: '',
        type: NotificationType.textSms,
        metadata: { content },
      });

      await resolver.notifyInternal(notifyParams);

      expect(notifyParams.metadata.content).toEqual(
        content.replace('@user.firstName@', user.firstName),
      );

      expect(spyOnNotificationsServiceSend).toBeCalledWith({
        sendNotificationToUserParams: {
          data: {
            user: {
              phone: user.phone,
            },
          },
          metadata: notifyParams.metadata,
        },
      });
    });
  });
});
