import { MemberRole, UserRole } from '@argus/hepiusClient';
import { AlertInternalKey, ExternalKey, generateDispatchId } from '@argus/irisClient';
import {
  GlobalEventType,
  IEventNotifySlack,
  NotificationType,
  Platform,
  QueueType,
  SlackChannel,
  SlackIcon,
  StorageType,
  generateId,
  generateObjectId,
  generatePhone,
  mockLogger,
  mockProcessWarnings,
  randomEnum,
} from '@argus/pandora';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { articlesPath, hosts } from 'config';
import { datatype, date, lorem } from 'faker';
import { Types } from 'mongoose';
import { v4 } from 'uuid';
import {
  dbDisconnect,
  defaultModules,
  generateCommunication,
  generateCreateMemberParams,
  generateDeleteMemberParams,
  generateEndAppointmentParams,
  generateMemberConfig,
  generateNotifyContentParams,
  generateNotifyParams,
  generateOrgParams,
  generateScheduleAppointmentParams,
  generateUniqueUrl,
  generateUpdateClientSettings,
  generateUpdateMemberConfigParams,
  generateUpdateMemberParams,
  mockGenerateAlert,
  mockGenerateJourney,
  mockGenerateMember,
  mockGenerateMemberConfig,
  mockGenerateOrg,
  mockGenerateQuestionnaireResponse,
  mockGenerateUser,
} from '..';
import {
  ErrorType,
  Errors,
  EventType,
  IEventDeleteMember,
  IEventNotifyQueue,
  IEventOnAlertForQRSubmit,
  IEventOnNewMember,
  IEventOnReceivedChatMessage,
  IEventOnReceivedTextMessage,
  IEventOnUpdatedMemberPlatform,
  LoggerService,
  PhoneType,
  RegisterForNotificationParams,
  delay,
} from '../../src/common';
import {
  Communication,
  CommunicationResolver,
  CommunicationService,
} from '../../src/communication';
import {
  DischargeDocumentType,
  Member,
  MemberModule,
  MemberResolver,
  MemberService,
} from '../../src/member';
import { GraduateMemberParams, JourneyService } from '../../src/journey';
import {
  CognitoService,
  FeatureFlagService,
  OneSignal,
  StorageService,
  TwilioService,
} from '../../src/providers';
import {
  QuestionnaireAlerts,
  QuestionnaireService,
  QuestionnaireType,
} from '../../src/questionnaire';
import { UserService } from '../../src/user';
import { TodoService } from '../../src/todo';
import { AppointmentService } from '../../src/appointment';
import { OrgService } from '../../src/org';
import { ActionItemService } from '../../src/actionItem';

describe('MemberResolver', () => {
  let module: TestingModule;
  let resolver: MemberResolver;
  let service: MemberService;
  let userService: UserService;
  let todoService: TodoService;
  let actionItemService: ActionItemService;
  let questionnaireService: QuestionnaireService;
  let appointmentService: AppointmentService;
  let storage: StorageService;
  let cognitoService: CognitoService;
  let communicationResolver: CommunicationResolver;
  let oneSignal: OneSignal;
  let communicationService: CommunicationService;
  let eventEmitter: EventEmitter2;
  let featureFlagService: FeatureFlagService;
  let twilioService: TwilioService;
  let journeyService: JourneyService;
  let orgService: OrgService;
  let spyOnEventEmitter;

  beforeAll(async () => {
    mockProcessWarnings(); // to hide pino prettyPrint warning
    module = await Test.createTestingModule({
      imports: defaultModules().concat(MemberModule),
    }).compile();

    resolver = module.get<MemberResolver>(MemberResolver);
    service = module.get<MemberService>(MemberService);
    userService = module.get<UserService>(UserService);
    todoService = module.get<TodoService>(TodoService);
    actionItemService = module.get<ActionItemService>(ActionItemService);
    questionnaireService = module.get<QuestionnaireService>(QuestionnaireService);
    appointmentService = module.get<AppointmentService>(AppointmentService);
    storage = module.get<StorageService>(StorageService);
    cognitoService = module.get<CognitoService>(CognitoService);
    oneSignal = module.get<OneSignal>(OneSignal);
    communicationResolver = module.get<CommunicationResolver>(CommunicationResolver);
    communicationService = module.get<CommunicationService>(CommunicationService);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
    spyOnEventEmitter = jest.spyOn(eventEmitter, 'emit');
    featureFlagService = module.get<FeatureFlagService>(FeatureFlagService);
    twilioService = module.get<TwilioService>(TwilioService);
    journeyService = module.get<JourneyService>(JourneyService);
    orgService = module.get<OrgService>(OrgService);
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
    let spyOnServiceGet;
    let spyOnServiceInsertControl;
    let spyOnServiceGetAvailableUser;
    let spyOnUserServiceGetUser;
    let spyOnServiceGetMemberConfig;
    let spyOnFeatureFlagControlGroup;
    let spyOnTwilioGetPhoneType;
    let spyOnJourneyCreate;
    let spyOnOrgServiceGetOrg;

    beforeEach(() => {
      spyOnServiceInsert = jest.spyOn(service, 'insert');
      spyOnServiceGet = jest.spyOn(service, 'get');
      spyOnServiceInsertControl = jest.spyOn(service, 'insertControl');
      spyOnServiceGetAvailableUser = jest.spyOn(userService, 'getAvailableUser');
      spyOnUserServiceGetUser = jest.spyOn(userService, 'get');
      spyOnServiceGetMemberConfig = jest.spyOn(service, 'getMemberConfig');
      spyOnFeatureFlagControlGroup = jest.spyOn(featureFlagService, 'isControlGroup');
      spyOnTwilioGetPhoneType = jest.spyOn(twilioService, 'getPhoneType');
      spyOnJourneyCreate = jest.spyOn(journeyService, 'create');
      spyOnOrgServiceGetOrg = jest.spyOn(orgService, 'get');
    });

    afterEach(() => {
      spyOnServiceInsert.mockReset();
      spyOnServiceGet.mockReset();
      spyOnServiceInsertControl.mockReset();
      spyOnServiceGetAvailableUser.mockReset();
      spyOnUserServiceGetUser.mockReset();
      spyOnServiceGetMemberConfig.mockReset();
      spyOnEventEmitter.mockReset();
      spyOnFeatureFlagControlGroup.mockReset();
      spyOnTwilioGetPhoneType.mockReset();
      spyOnJourneyCreate.mockReset();
      spyOnOrgServiceGetOrg.mockReset();
    });

    it('should fail to create a member since org not found', async () => {
      spyOnFeatureFlagControlGroup.mockImplementationOnce(async () => false);
      await expect(
        resolver.createMember(generateCreateMemberParams({ orgId: generateId() })),
      ).rejects.toThrow(Errors.get(ErrorType.orgIdNotFound));
    });

    it('should fail to create a control member since org not found', async () => {
      spyOnFeatureFlagControlGroup.mockImplementationOnce(async () => true);
      await expect(
        resolver.createMember(generateCreateMemberParams({ orgId: generateId() })),
      ).rejects.toThrow(Errors.get(ErrorType.orgIdNotFound));
    });

    it('should create a member', async () => {
      const member = mockGenerateMember();
      const user = mockGenerateUser();
      const memberConfig = generateMemberConfig({
        memberId: generateObjectId(member.id),
        platform: Platform.android,
      });
      const phoneType: PhoneType = 'mobile';
      spyOnServiceInsert.mockImplementationOnce(async () => ({ id: member.id }));
      spyOnServiceGet.mockImplementationOnce(async () => member);
      spyOnServiceGetMemberConfig.mockImplementationOnce(async () => memberConfig);
      spyOnServiceGetAvailableUser.mockImplementationOnce(async () => member.primaryUserId);
      spyOnUserServiceGetUser.mockImplementationOnce(async () => user);
      spyOnFeatureFlagControlGroup.mockImplementationOnce(async () => false);
      spyOnTwilioGetPhoneType.mockResolvedValueOnce(phoneType);
      spyOnJourneyCreate.mockResolvedValueOnce(generateId());

      const org = mockGenerateOrg();
      spyOnOrgServiceGetOrg.mockResolvedValueOnce(org);
      const params = generateCreateMemberParams({ orgId: org.id });
      const { orgId, ...noOrgParams } = params;

      await resolver.createMember(params);

      expect(spyOnServiceInsert).toBeCalledTimes(1);
      expect(spyOnServiceInsert).toBeCalledWith(
        { ...noOrgParams, phoneType },
        member.primaryUserId,
      );
      expect(spyOnServiceGetAvailableUser).toBeCalledTimes(1);
      expect(spyOnServiceGetMemberConfig).toBeCalledTimes(1);
      expect(spyOnServiceGetMemberConfig).toBeCalledWith(member.id);
      expect(spyOnTwilioGetPhoneType).toBeCalledWith(params.phone);
      expect(spyOnJourneyCreate).toBeCalledWith({ memberId: member.id, orgId });
      expect(spyOnOrgServiceGetOrg).toBeCalledWith(orgId);
      const eventNewMemberParams: IEventOnNewMember = {
        member,
        user,
        platform: memberConfig.platform,
      };

      expect(spyOnEventEmitter).toBeCalledTimes(3);
      const eventNotifyQueue: IEventNotifyQueue = {
        type: QueueType.notifications,
        message: JSON.stringify(generateUpdateClientSettings({ member, memberConfig, org })),
      };
      expect(spyOnEventEmitter).toHaveBeenNthCalledWith(
        1,
        GlobalEventType.notifyQueue,
        eventNotifyQueue,
      );
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
        orgName: org.name,
      };
      expect(spyOnEventEmitter).toHaveBeenNthCalledWith(
        3,
        GlobalEventType.notifySlack,
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
      spyOnServiceInsert.mockImplementationOnce(async () => ({ id: member.id }));
      spyOnServiceGet.mockImplementationOnce(async () => member);
      spyOnServiceGetMemberConfig.mockImplementationOnce(async () => memberConfig);
      spyOnServiceGetAvailableUser.mockImplementationOnce(async () => member.primaryUserId);
      spyOnUserServiceGetUser.mockImplementationOnce(async () => user);
      //forcing true to be sure it won't be control member, even if control rolled true.
      spyOnFeatureFlagControlGroup.mockImplementationOnce(async () => true);
      spyOnTwilioGetPhoneType.mockResolvedValueOnce(phoneType);
      spyOnJourneyCreate.mockResolvedValueOnce(generateId());
      const org = mockGenerateOrg();
      spyOnOrgServiceGetOrg.mockResolvedValueOnce(org);

      const params = generateCreateMemberParams({ orgId: generateId(), userId: user.id });
      const { orgId, ...noOrgParams } = params;
      await resolver.createMember(params);

      expect(spyOnServiceInsert).toBeCalledTimes(1);
      expect(spyOnServiceInsert).toBeCalledWith(
        { ...noOrgParams, phoneType },
        new Types.ObjectId(user.id),
      );
      expect(spyOnServiceGetMemberConfig).toBeCalledTimes(1);
      expect(spyOnServiceGetMemberConfig).toBeCalledWith(member.id);
      const eventNewMemberParams: IEventOnNewMember = {
        member,
        user,
        platform: memberConfig.platform,
      };
      expect(spyOnJourneyCreate).toBeCalledWith({ memberId: member.id, orgId });
      expect(spyOnOrgServiceGetOrg).toBeCalledWith(orgId);
      expect(spyOnEventEmitter).toBeCalledWith(EventType.onNewMember, eventNewMemberParams);
      const eventSlackMessageParams: IEventNotifySlack = {
        /* eslint-disable-next-line max-len */
        header: `*New _real_ member*`,
        message: `${member.firstName} [${member.id}]\nAssigned to ${user.firstName}`,
        icon: SlackIcon.info,
        channel: SlackChannel.support,
        orgName: org.name,
      };
      expect(spyOnEventEmitter).toBeCalledWith(
        GlobalEventType.notifySlack,
        eventSlackMessageParams,
      );
    });

    it('should create a control member', async () => {
      const member = mockGenerateMember();
      const phoneType: PhoneType = 'mobile';

      spyOnServiceInsertControl.mockImplementationOnce(async () => member);
      spyOnFeatureFlagControlGroup.mockImplementationOnce(async () => true);
      spyOnTwilioGetPhoneType.mockResolvedValueOnce(phoneType);
      const org = mockGenerateOrg();
      spyOnOrgServiceGetOrg.mockResolvedValueOnce(org);

      const params = generateCreateMemberParams({ orgId: generateId() });
      const noOrgParams = { ...params };
      delete noOrgParams.orgId;
      await resolver.createMember(params);

      expect(spyOnServiceInsertControl).toBeCalledTimes(1);
      expect(spyOnServiceInsertControl).toBeCalledWith({ ...noOrgParams, phoneType });
      const eventNotifyQueue: IEventNotifyQueue = {
        type: QueueType.notifications,
        message: JSON.stringify(generateUpdateClientSettings({ member, org })),
      };
      expect(spyOnEventEmitter).toHaveBeenCalledWith(GlobalEventType.notifyQueue, eventNotifyQueue);
      expect(spyOnJourneyCreate).not.toBeCalled();

      const eventSlackMessageParams: IEventNotifySlack = {
        /* eslint-disable-next-line max-len */
        header: `*New _control_ member*`,
        message: `${member.firstName} [${member.id}]`,
        icon: SlackIcon.info,
        channel: SlackChannel.support,
        orgName: org.name,
      };
      expect(spyOnEventEmitter).toHaveBeenCalledWith(
        GlobalEventType.notifySlack,
        eventSlackMessageParams,
      );
    });
  });

  describe('updateMember', () => {
    let spyOnServiceUpdate;
    let spyOnServiceGetRecent;
    let spyOnTwilioGetPhoneType;

    beforeEach(() => {
      spyOnServiceUpdate = jest.spyOn(service, 'update');
      spyOnServiceGetRecent = jest.spyOn(journeyService, 'getRecent');
      spyOnTwilioGetPhoneType = jest.spyOn(twilioService, 'getPhoneType');
    });

    afterEach(() => {
      spyOnServiceUpdate.mockReset();
      spyOnServiceGetRecent.mockReset();
      spyOnTwilioGetPhoneType.mockReset();
    });

    test.each(['mobile', 'landline', 'voip'])(
      `should update a member with phoneSecondary and phoneSecondaryType=%p`,
      async (phoneSecondaryType) => {
        const updateMemberParams = generateUpdateMemberParams();
        spyOnServiceUpdate.mockImplementationOnce(async () => ({ ...updateMemberParams }));
        spyOnServiceGetRecent.mockResolvedValueOnce({
          org: { id: generateId(), ...generateOrgParams() },
        });
        spyOnTwilioGetPhoneType.mockResolvedValueOnce(phoneSecondaryType);

        const member = await resolver.updateMember(updateMemberParams);

        expect(spyOnServiceUpdate).toBeCalledTimes(1);
        expect(spyOnServiceUpdate).toBeCalledWith({
          ...updateMemberParams,
          phoneSecondaryType,
        });

        const eventParams: IEventNotifyQueue = {
          type: QueueType.notifications,
          message: JSON.stringify(generateUpdateClientSettings({ member })),
        };
        expect(spyOnEventEmitter).toBeCalledWith(GlobalEventType.notifyQueue, eventParams);
      },
    );

    it('should update a member without phoneSecondary and phoneSecondaryType', async () => {
      const updateMemberParams = generateUpdateMemberParams();
      updateMemberParams.phoneSecondary = undefined;
      spyOnServiceUpdate.mockImplementationOnce(async () => ({ ...updateMemberParams }));
      spyOnServiceGetRecent.mockResolvedValueOnce({
        org: { id: generateId(), ...generateOrgParams() },
      });

      await resolver.updateMember(updateMemberParams);

      expect(spyOnServiceUpdate).toBeCalledTimes(1);
      expect(spyOnTwilioGetPhoneType).not.toBeCalled();
      expect(spyOnServiceUpdate).toBeCalledWith(updateMemberParams);
    });
  });

  describe('getMember', () => {
    let spyOnServiceGet;
    let spyOnServiceGetRecentJourney;
    beforeEach(() => {
      spyOnServiceGet = jest.spyOn(service, 'get');
      spyOnServiceGetRecentJourney = jest.spyOn(journeyService, 'getRecent');
    });

    afterEach(() => {
      spyOnServiceGet.mockReset();
      spyOnServiceGetRecentJourney.mockReset();
    });

    it('should get a member for a given id', async () => {
      const member = mockGenerateMember();
      spyOnServiceGet.mockImplementationOnce(async () => member);
      spyOnServiceGetRecentJourney.mockResolvedValueOnce(
        mockGenerateJourney({ memberId: member.id }),
      );
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
      const org = generateOrgParams();
      spyOnServiceGetRecentJourney.mockResolvedValueOnce({ id: generateId(), org });
      const result = await resolver.getMember(member.id);
      expect(result.zipCode).toEqual(org.zipCode);
    });

    it('should calculate utcDelta if zipCode exists', async () => {
      const member = mockGenerateMember();
      spyOnServiceGet.mockResolvedValue(member);
      spyOnServiceGetRecentJourney.mockResolvedValueOnce({
        id: generateId(),
        org: generateOrgParams(),
      });
      const result = await resolver.getMember(member.id);
      expect(result.utcDelta).toBeLessThan(0);
    });
  });

  describe('deleteMember', () => {
    let spyOnServiceDeleteMember;
    let spyOnOneSignalUnregister;
    let spyOnCognitoServiceDeleteClient;
    let spyOnStorageServiceDeleteMember;
    let spyOnDeleteSchedules;
    let spyOnNotifyDeletedMemberConfig;

    beforeEach(() => {
      spyOnServiceDeleteMember = jest.spyOn(service, 'deleteMember');
      spyOnOneSignalUnregister = jest.spyOn(oneSignal, 'unregister');
      spyOnCognitoServiceDeleteClient = jest.spyOn(cognitoService, 'deleteClient');
      spyOnStorageServiceDeleteMember = jest.spyOn(storage, 'deleteMember');
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      spyOnNotifyDeletedMemberConfig = jest.spyOn(resolver, 'notifyDeletedMemberConfig');
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      spyOnDeleteSchedules = jest.spyOn(resolver, 'deleteSchedules');
      spyOnServiceDeleteMember.mockImplementation(async () => undefined);
      spyOnOneSignalUnregister.mockImplementation(async () => undefined);
      spyOnCognitoServiceDeleteClient.mockImplementation(async () => undefined);
      spyOnStorageServiceDeleteMember.mockImplementation(async () => undefined);
      spyOnDeleteSchedules.mockImplementation(async () => undefined);
      spyOnNotifyDeletedMemberConfig.mockImplementation(async () => undefined);
    });

    afterEach(() => {
      spyOnServiceDeleteMember.mockReset();
      spyOnCognitoServiceDeleteClient.mockReset();
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
      if (!params.deviceId) {
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
        expect(spyOnCognitoServiceDeleteClient).toBeCalledWith(member.deviceId);
      } else {
        expect(spyOnCognitoServiceDeleteClient).not.toHaveBeenCalled();
      }
      const eventParams: IEventDeleteMember = {
        memberId: member.id,
        deletedBy: userId,
        hard: params.hard,
      };
      expect(spyOnDeleteSchedules).toBeCalledWith(eventParams);
      expect(spyOnServiceDeleteMember).toBeCalledWith(deleteMemberParams, userId);
      expect(spyOnNotifyDeletedMemberConfig).toBeCalledWith(member.id, params.hard);
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

  describe('deleteDischargeDocument', () => {
    let spyOnServiceGet;
    let spyOnStorage;

    beforeEach(() => {
      spyOnServiceGet = jest.spyOn(service, 'get');
      spyOnStorage = jest.spyOn(storage, 'moveToDeleted');
    });

    afterEach(() => {
      spyOnServiceGet.mockReset();
      spyOnStorage.mockReset();
    });

    test.each([DischargeDocumentType.Summary, DischargeDocumentType.Instructions])(
      'should delete discharge document of type %p',
      async (dischargeDocumentType) => {
        const member = mockGenerateMember();
        spyOnServiceGet.mockImplementationOnce(async () => member);
        spyOnStorage.mockImplementation(async () => true);

        await resolver.deleteDischargeDocument({
          memberId: member.id,
          dischargeDocumentType,
        });

        expect(spyOnServiceGet).toBeCalledTimes(1);
        expect(spyOnServiceGet).toBeCalledWith(member.id);
        expect(spyOnStorage).toBeCalledTimes(1);
        expect(spyOnStorage).toHaveBeenCalledWith({
          storageType: StorageType.documents,
          memberId: member.id,
          id: `${member.firstName}_${member.lastName}_${dischargeDocumentType}.pdf`,
        });
      },
    );
  });

  describe('getMemberUploadGeneralDocumentLink', () => {
    let spyOnServiceGet;
    let spyOnStorageAlreadyExists;
    let spyOnStorageUpload;

    beforeEach(() => {
      spyOnStorageAlreadyExists = jest.spyOn(storage, 'doesDocumentAlreadyExists');
      spyOnServiceGet = jest.spyOn(service, 'get');
      spyOnStorageUpload = jest.spyOn(storage, 'getUploadUrl');
    });

    afterEach(() => {
      spyOnServiceGet.mockReset();
      spyOnStorageAlreadyExists.mockReset();
      spyOnStorageUpload.mockReset();
    });

    it('should get upload link', async () => {
      const member = mockGenerateMember();
      spyOnServiceGet.mockImplementationOnce(async () => member);
      spyOnStorageAlreadyExists.mockImplementationOnce(async () => false);
      spyOnStorageUpload.mockImplementation(async () => 'https://aws-bucket-path/extras');

      const fileName = lorem.word();
      await resolver.getMemberUploadGeneralDocumentLink({ memberId: member.id, fileName });

      expect(spyOnServiceGet).toBeCalledTimes(1);
      expect(spyOnServiceGet).toBeCalledWith(member.id);
      expect(spyOnStorageAlreadyExists).toBeCalledTimes(1);
      expect(spyOnStorageUpload).toBeCalledWith({
        storageType: StorageType.general,
        memberId: member.id,
        id: fileName,
      });
    });

    it('should fail to get upload link if document already exists', async () => {
      const member = mockGenerateMember();
      spyOnServiceGet.mockImplementationOnce(async () => member);
      spyOnStorageAlreadyExists.mockImplementationOnce(async () => true);
      spyOnStorageUpload.mockImplementation(async () => 'https://aws-bucket-path/extras');

      const fileName = lorem.word();
      await expect(
        resolver.getMemberUploadGeneralDocumentLink({ memberId: member.id, fileName }),
      ).rejects.toThrow(Errors.get(ErrorType.memberUploadAlreadyExistingGeneralDocument));
    });
  });

  describe('getMemberDownloadGeneralDocumentsLinks', () => {
    let spyOnServiceGet;
    let spyOnStorageGetFolderFiles;
    let spyOnStorageDownload;

    beforeEach(() => {
      spyOnServiceGet = jest.spyOn(service, 'get');
      spyOnStorageGetFolderFiles = jest.spyOn(storage, 'getFolderFiles');
      spyOnStorageDownload = jest.spyOn(storage, 'getDownloadUrl');
    });

    afterEach(() => {
      spyOnServiceGet.mockReset();
      spyOnStorageGetFolderFiles.mockReset();
      spyOnStorageDownload.mockReset();
    });

    it('should get download link', async () => {
      const member = mockGenerateMember();
      const files = [lorem.word(), lorem.word(), lorem.word()];
      spyOnServiceGet.mockImplementationOnce(async () => member);
      spyOnStorageGetFolderFiles.mockImplementationOnce(async () => files);
      spyOnStorageDownload.mockImplementation(
        async (params) => `https://aws-bucket-path/extras/${params.id}`,
      );

      const result = await resolver.getMemberDownloadGeneralDocumentsLinks(member.id);

      expect(spyOnServiceGet).toBeCalledTimes(1);
      expect(spyOnServiceGet).toBeCalledWith(member.id);
      expect(spyOnStorageGetFolderFiles).toBeCalledTimes(1);
      expect(spyOnStorageDownload).toBeCalledTimes(files.length);
      files.forEach((file) => {
        expect(spyOnStorageDownload).toBeCalledWith({
          storageType: StorageType.general,
          memberId: member.id,
          id: file,
        });
      });
      expect(result).toEqual(
        expect.arrayContaining(files.map((file) => `https://aws-bucket-path/extras/${file}`)),
      );
    });
  });

  describe('deleteMemberGeneralDocument', () => {
    let spyOnServiceGet;
    let spyOnStorageDeleteFile;

    beforeEach(() => {
      spyOnServiceGet = jest.spyOn(service, 'get');
      spyOnStorageDeleteFile = jest.spyOn(storage, 'deleteFile');
    });

    afterEach(() => {
      spyOnServiceGet.mockReset();
      spyOnStorageDeleteFile.mockReset();
    });

    it('should get download link', async () => {
      const member = mockGenerateMember();
      const fileName = lorem.word();
      spyOnServiceGet.mockImplementationOnce(async () => member);
      spyOnStorageDeleteFile.mockImplementationOnce(async () => true);

      const result = await resolver.deleteMemberGeneralDocument({ memberId: member.id, fileName });

      expect(spyOnServiceGet).toBeCalledTimes(1);
      expect(spyOnServiceGet).toBeCalledWith(member.id);
      expect(spyOnStorageDeleteFile).toBeCalledTimes(1);
      expect(spyOnStorageDeleteFile).toBeCalledWith({
        storageType: StorageType.general,
        memberId: member.id,
        id: fileName,
      });
      expect(result).toBeTruthy();
    });
  });

  describe('getMemberConfig', () => {
    let spyOnServiceGetMemberConfig;
    let spyOnServiceGetRecentJourney;
    beforeEach(() => {
      spyOnServiceGetMemberConfig = jest.spyOn(service, 'getMemberConfig');
      spyOnServiceGetRecentJourney = jest.spyOn(journeyService, 'getRecent');
    });

    afterEach(() => {
      spyOnServiceGetMemberConfig.mockReset();
      spyOnServiceGetRecentJourney.mockReset();
    });

    it('should call MemberConfig', async () => {
      const memberConfig = mockGenerateMemberConfig();
      spyOnServiceGetMemberConfig.mockImplementationOnce(async () => memberConfig);
      spyOnServiceGetRecentJourney.mockResolvedValueOnce(
        mockGenerateJourney({ memberId: memberConfig.memberId.toString() }),
      );
      const result = await resolver.getMemberConfig(memberConfig.memberId.toString());

      expect(spyOnServiceGetMemberConfig).toBeCalledTimes(1);
      expect(spyOnServiceGetMemberConfig).toBeCalledWith(memberConfig.memberId.toString());
      expect(spyOnServiceGetRecentJourney).toBeCalledWith(memberConfig.memberId.toString());

      expect(result.articlesPath).toEqual(articlesPath);
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
      expect(spyOnEventEmitter).toBeCalledWith(GlobalEventType.notifyQueue, eventParams);
    });
  });

  describe('registerMemberForNotifications', () => {
    let spyOnOneSignalRegister;
    let spyOnServiceGetMember;
    let spyOnServiceGetMemberConfig;
    let spyOnServiceUpdateMemberConfig;
    let spyOnServiceUpdateJourneyLoggedInAt;
    let spyOnServiceGetRecentJourney;

    beforeEach(() => {
      spyOnOneSignalRegister = jest.spyOn(oneSignal, 'register');
      spyOnServiceGetMember = jest.spyOn(service, 'get');
      spyOnServiceGetMemberConfig = jest.spyOn(service, 'getMemberConfig');
      spyOnServiceUpdateMemberConfig = jest.spyOn(service, 'updateMemberConfig');
      spyOnServiceUpdateJourneyLoggedInAt = jest.spyOn(journeyService, 'updateLoggedInAt');
      spyOnServiceGetRecentJourney = jest.spyOn(journeyService, 'getRecent');
    });

    afterEach(() => {
      spyOnOneSignalRegister.mockReset();
      spyOnServiceGetMember.mockReset();
      spyOnServiceGetMemberConfig.mockReset();
      spyOnServiceUpdateMemberConfig.mockReset();
      spyOnServiceUpdateJourneyLoggedInAt.mockReset();
      spyOnServiceGetRecentJourney.mockReset();
      spyOnEventEmitter.mockReset();
      spyOnEventEmitter.mockClear();
    });

    it('should not call notificationsService on platform=android', async () => {
      spyOnOneSignalRegister.mockImplementationOnce(async () => undefined);
      const currentMemberConfig = mockGenerateMemberConfig();
      const member = mockGenerateMember();
      member.id = currentMemberConfig.memberId.toString();
      const journey = mockGenerateJourney({ memberId: member.id });
      delete journey.firstLoggedInAt;
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
      spyOnServiceUpdateJourneyLoggedInAt.mockResolvedValueOnce(journey);
      spyOnServiceGetRecentJourney.mockResolvedValueOnce(journey);
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
      expect(spyOnServiceUpdateJourneyLoggedInAt).toBeCalledWith(memberConfig.memberId);
      const eventParams: IEventNotifyQueue = {
        type: QueueType.notifications,
        message: JSON.stringify(generateUpdateClientSettings({ memberConfig })),
      };
      expect(spyOnEventEmitter).toBeCalledWith(GlobalEventType.notifyQueue, eventParams);
    });

    it('should call notificationsService on platform=ios', async () => {
      const currentMemberConfig = mockGenerateMemberConfig();
      const member = mockGenerateMember();
      member.id = currentMemberConfig.memberId.toString();
      const journey = mockGenerateJourney({ memberId: member.id });
      delete journey.firstLoggedInAt;
      spyOnServiceGetMemberConfig.mockImplementationOnce(async () => currentMemberConfig);
      spyOnServiceGetMember.mockImplementationOnce(async () => member);

      const updateFields = {
        platform: Platform.ios,
        isPushNotificationsEnabled: currentMemberConfig.isPushNotificationsEnabled,
        token: lorem.word(),
      };
      const params: RegisterForNotificationParams = { ...updateFields };
      const memberConfig = generateMemberConfig({
        memberId: currentMemberConfig.memberId,
        ...updateFields,
      });
      spyOnServiceUpdateMemberConfig.mockImplementationOnce(async () => memberConfig);
      spyOnServiceUpdateJourneyLoggedInAt.mockResolvedValueOnce(journey);
      spyOnServiceGetRecentJourney.mockResolvedValueOnce(journey);
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
      expect(spyOnEventEmitter).toHaveBeenNthCalledWith(2, GlobalEventType.notifyQueue, notify);
    });

    it('should not call updateLoggedInAt if firstLoggedInAt exists', async () => {
      const currentMemberConfig = mockGenerateMemberConfig();
      const member = mockGenerateMember();
      member.id = currentMemberConfig.memberId.toString();
      const journey = mockGenerateJourney({ memberId: member.id });
      spyOnServiceGetMember.mockImplementationOnce(async () => member);
      spyOnServiceGetMemberConfig.mockImplementationOnce(async () => currentMemberConfig);
      spyOnServiceGetRecentJourney.mockResolvedValueOnce(journey);
      spyOnServiceUpdateJourneyLoggedInAt.mockResolvedValueOnce(journey);
      spyOnServiceUpdateMemberConfig.mockImplementationOnce(async () => memberConfig);

      const updateFields = {
        platform: Platform.android,
        isPushNotificationsEnabled: false,
      };
      const params: RegisterForNotificationParams = { ...updateFields };
      const memberConfig = generateMemberConfig({
        memberId: currentMemberConfig.memberId,
        ...updateFields,
      });

      await resolver.registerMemberForNotifications([MemberRole.member], member.id, params);

      const eventParams: IEventNotifyQueue = {
        type: QueueType.notifications,
        message: JSON.stringify(generateUpdateClientSettings({ memberConfig, journey })),
      };
      expect(spyOnEventEmitter).toBeCalledWith(GlobalEventType.notifyQueue, eventParams);
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
        resolver.registerMemberForNotifications([UserRole.lagunaCoach], member.id, params),
      ).rejects.toThrow(Errors.get(ErrorType.memberAllowedOnly));
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

  describe('graduateMember', () => {
    let spyOnServiceGetRecentJourney;
    let spyOnServiceGetMember;
    let spyOnServiceGetMemberConfig;
    let spyOnServiceGraduate;
    let spyOnCognitoServiceEnableClient;
    let spyOnCognitoServiceDisableClient;

    beforeEach(() => {
      spyOnServiceGetRecentJourney = jest.spyOn(journeyService, 'getRecent');
      spyOnServiceGetMember = jest.spyOn(service, 'get');
      spyOnServiceGetMemberConfig = jest.spyOn(service, 'getMemberConfig');
      spyOnServiceGraduate = jest.spyOn(journeyService, 'graduate');
      spyOnCognitoServiceEnableClient = jest.spyOn(cognitoService, 'enableClient');
      spyOnCognitoServiceDisableClient = jest.spyOn(cognitoService, 'disableClient');
    });

    afterEach(() => {
      spyOnServiceGetRecentJourney.mockReset();
      spyOnServiceGetMember.mockReset();
      spyOnServiceGetMemberConfig.mockReset();
      spyOnServiceGraduate.mockReset();
      spyOnCognitoServiceEnableClient.mockReset();
      spyOnCognitoServiceDisableClient.mockReset();
    });

    test.each([Platform.web, Platform.android, Platform.ios])(
      'should graduate an existing member(true)',
      async (platform) => {
        const deviceId = v4();
        spyOnServiceGetRecentJourney.mockResolvedValue({ isGraduated: false });
        spyOnServiceGetMember.mockResolvedValue({ deviceId });
        spyOnServiceGetMemberConfig.mockResolvedValue({ platform });
        spyOnServiceGraduate.mockResolvedValue(undefined);
        spyOnCognitoServiceDisableClient.mockResolvedValue(true);

        const graduateMemberParams: GraduateMemberParams = {
          id: generateId(),
          isGraduated: true,
        };
        await resolver.graduateMember(graduateMemberParams);
        if (platform !== Platform.web) {
          expect(spyOnCognitoServiceDisableClient).toBeCalledWith(deviceId);
        } else {
          expect(spyOnCognitoServiceEnableClient).not.toBeCalled();
        }
        expect(spyOnCognitoServiceEnableClient).not.toBeCalled();
        expect(spyOnServiceGraduate).toBeCalledWith(graduateMemberParams);
      },
    );

    test.each([Platform.web, Platform.android, Platform.ios])(
      'should graduate an existing member(false)',
      async (platform) => {
        const deviceId = v4();
        spyOnServiceGetRecentJourney.mockResolvedValue({ isGraduated: true });
        spyOnServiceGetMember.mockResolvedValue({ deviceId });
        spyOnServiceGetMemberConfig.mockResolvedValue({ platform });
        spyOnServiceGraduate.mockResolvedValue(undefined);
        spyOnCognitoServiceDisableClient.mockResolvedValue(true);

        const graduateMemberParams: GraduateMemberParams = {
          id: generateId(),
          isGraduated: false,
        };
        await resolver.graduateMember(graduateMemberParams);
        if (platform !== Platform.web) {
          expect(spyOnCognitoServiceEnableClient).toBeCalledWith(deviceId);
        } else {
          expect(spyOnCognitoServiceEnableClient).not.toBeCalled();
        }
        expect(spyOnCognitoServiceDisableClient).not.toBeCalled();
        expect(spyOnServiceGraduate).toBeCalledWith(graduateMemberParams);
      },
    );

    [Platform.web, Platform.android, Platform.ios].forEach((platform) => {
      test.each([true, false])(
        'should not update isGraduated to %p since it is already %p',
        async (isGraduated) => {
          const deviceId = v4();
          spyOnServiceGetRecentJourney.mockResolvedValue({ isGraduated });
          spyOnServiceGetMember.mockResolvedValue({ deviceId });
          spyOnServiceGetMemberConfig.mockResolvedValue({ platform });
          spyOnServiceGraduate.mockResolvedValue(undefined);
          spyOnCognitoServiceDisableClient.mockResolvedValue(true);

          const graduateMemberParams: GraduateMemberParams = { id: generateId(), isGraduated };
          await resolver.graduateMember(graduateMemberParams);
          expect(spyOnServiceGraduate).not.toBeCalled();
          expect(spyOnCognitoServiceDisableClient).not.toBeCalled();
          expect(spyOnCognitoServiceEnableClient).not.toBeCalled();
        },
      );
    });
  });

  describe('notify', () => {
    let spyOnServiceGetMember;
    let spyOnServiceGetMemberConfig;
    let spyOnUserServiceGetUser;
    let spyOnCommunicationResolverGetCommunication;
    let spyOnCommunicationServiceGet;
    let spyOnCreateDispatch;
    let spyOnJourneyServiceGetRecentJourney;

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
      spyOnJourneyServiceGetRecentJourney = jest.spyOn(journeyService, 'getRecent');
    });

    afterEach(() => {
      spyOnServiceGetMember.mockReset();
      spyOnServiceGetMemberConfig.mockReset();
      spyOnUserServiceGetUser.mockReset();
      spyOnCommunicationResolverGetCommunication.mockReset();
      spyOnCommunicationServiceGet.mockReset();
      spyOnCreateDispatch.mockReset();
      spyOnJourneyServiceGetRecentJourney.mockReset();
    });

    it('should catch notify exception on non existing user', async () => {
      const member = mockGenerateMember();
      const memberConfig = mockGenerateMemberConfig();
      spyOnServiceGetMember.mockImplementationOnce(async () => member);
      spyOnServiceGetMemberConfig.mockImplementationOnce(async () => memberConfig);
      spyOnUserServiceGetUser.mockImplementationOnce(async () => undefined);
      spyOnJourneyServiceGetRecentJourney.mockResolvedValueOnce(mockGenerateOrg());

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
      spyOnJourneyServiceGetRecentJourney.mockResolvedValueOnce(mockGenerateOrg());

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
        spyOnJourneyServiceGetRecentJourney.mockResolvedValueOnce(mockGenerateOrg());

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
        spyOnJourneyServiceGetRecentJourney.mockResolvedValueOnce(mockGenerateOrg());

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
      spyOnJourneyServiceGetRecentJourney.mockResolvedValueOnce(mockGenerateOrg());

      const notifyParams = generateNotifyParams({
        type: NotificationType.textSms,
        metadata: { peerId: v4(), content: `    ${lorem.sentence()}     ` },
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
      spyOnJourneyServiceGetRecentJourney.mockResolvedValueOnce(mockGenerateOrg());

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
    let spyOnJourneyServiceGetRecentJourney;

    beforeEach(() => {
      spyOnServiceGetMember = jest.spyOn(service, 'get');
      spyOnServiceGetMemberConfig = jest.spyOn(service, 'getMemberConfig');
      spyOnUserServiceGetUser = jest.spyOn(userService, 'get');
      spyOnJourneyServiceGetRecentJourney = jest.spyOn(journeyService, 'getRecent');
    });

    afterEach(() => {
      spyOnServiceGetMember.mockReset();
      spyOnServiceGetMemberConfig.mockReset();
      spyOnUserServiceGetUser.mockReset();
      spyOnJourneyServiceGetRecentJourney.mockReset();
    });

    it('should catch notify exception on non existing user', async () => {
      const member = mockGenerateMember();
      const memberConfig = mockGenerateMemberConfig();
      spyOnServiceGetMember.mockImplementationOnce(async () => member);
      spyOnServiceGetMemberConfig.mockImplementationOnce(async () => memberConfig);
      spyOnUserServiceGetUser.mockImplementationOnce(async () => undefined);
      spyOnJourneyServiceGetRecentJourney.mockResolvedValueOnce(mockGenerateOrg());

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
      spyOnJourneyServiceGetRecentJourney.mockResolvedValueOnce(mockGenerateOrg());

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
      memberConfig                             | contentKey                         | error
      ${{ platform: Platform.web }}            | ${ExternalKey.addCaregiverDetails} | ${ErrorType.notificationNotAllowedForWebMember}
      ${{ platform: Platform.web }}            | ${ExternalKey.setCallPermissions}  | ${ErrorType.notificationNotAllowedForWebMember}
      ${{ platform: Platform.web }}            | ${ExternalKey.answerQuestionnaire} | ${ErrorType.notificationNotAllowedForWebMember}
      ${{ isPushNotificationsEnabled: false }} | ${ExternalKey.addCaregiverDetails} | ${ErrorType.notificationNotAllowedForWebMember}
      ${{ isPushNotificationsEnabled: false }} | ${ExternalKey.setCallPermissions}  | ${ErrorType.notificationNotAllowedForWebMember}
      ${{ isPushNotificationsEnabled: false }} | ${ExternalKey.answerQuestionnaire} | ${ErrorType.notificationNotAllowedForWebMember}
      ${{
  platform: Platform.web,
  isPushNotificationsEnabled: true,
}} | ${ExternalKey.addCaregiverDetails} | ${ErrorType.notificationNotAllowedForWebMember}
      ${{
  platform: Platform.web,
  isPushNotificationsEnabled: true,
}} | ${ExternalKey.setCallPermissions} | ${ErrorType.notificationNotAllowedForWebMember}
      ${{
  platform: Platform.web,
  isPushNotificationsEnabled: true,
}} | ${ExternalKey.answerQuestionnaire} | ${ErrorType.notificationNotAllowedForWebMember}
      ${{
  platform: Platform.android,
  isPushNotificationsEnabled: false,
}} | ${ExternalKey.setCallPermissions} | ${ErrorType.notificationNotAllowedForWebMember}
      ${{
  platform: Platform.ios,
  isPushNotificationsEnabled: false,
}} | ${ExternalKey.setCallPermissions} | ${ErrorType.notificationNotAllowedForWebMember}
      ${{
  platform: Platform.android,
  isPushNotificationsEnabled: false,
}} | ${ExternalKey.setCallPermissions} | ${ErrorType.notificationNotAllowedForWebMember}
      ${{
  platform: Platform.ios,
  isPushNotificationsEnabled: false,
}} | ${ExternalKey.setCallPermissions} | ${ErrorType.notificationNotAllowedForWebMember}
      ${{ platform: Platform.android }}        | ${ExternalKey.scheduleAppointment} | ${ErrorType.notificationNotAllowedForMobileMember}
      ${{ platform: Platform.ios }}            | ${ExternalKey.scheduleAppointment} | ${ErrorType.notificationNotAllowedForMobileMember}
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
        spyOnJourneyServiceGetRecentJourney.mockResolvedValueOnce(mockGenerateOrg());

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
      spyOnJourneyServiceGetRecentJourney.mockResolvedValueOnce(mockGenerateOrg());

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
      const memberConfig = mockGenerateMemberConfig();
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
    let spyOnActionItemsServiceGetAlerts;
    let spyOnTodoServiceGetAlerts;
    let spyOnAppointmentServiceGetAlerts;
    let spyOnQuestionnareServiceGetAlerts;
    let spyOnServiceGetUserMembers;
    let spyOnJourneyServiceGetRecent;

    beforeEach(() => {
      spyOnServiceGetAlerts = jest.spyOn(service, 'getAlerts');
      spyOnActionItemsServiceGetAlerts = jest.spyOn(actionItemService, 'getAlerts');
      spyOnTodoServiceGetAlerts = jest.spyOn(todoService, 'getAlerts');
      spyOnAppointmentServiceGetAlerts = jest.spyOn(appointmentService, 'getAlerts');
      spyOnQuestionnareServiceGetAlerts = jest.spyOn(questionnaireService, 'getAlerts');
      spyOnServiceGetUserMembers = jest.spyOn(service, 'getUserMembers');
      spyOnJourneyServiceGetRecent = jest.spyOn(journeyService, 'getRecent');
    });

    afterEach(() => {
      spyOnServiceGetAlerts.mockReset();
      spyOnActionItemsServiceGetAlerts.mockReset();
      spyOnTodoServiceGetAlerts.mockReset();
      spyOnAppointmentServiceGetAlerts.mockReset();
      spyOnQuestionnareServiceGetAlerts.mockReset();
      spyOnServiceGetUserMembers.mockReset();
      spyOnJourneyServiceGetRecent.mockReset();
    });

    it('should call getAlerts', async () => {
      const journeyId = generateId();
      const userId = generateId();
      const lastQueryAlert = date.past(1);
      const alert = mockGenerateAlert();
      const actionItemsAlert = mockGenerateAlert();
      const todoAlert = mockGenerateAlert();
      const appointmentAlert = mockGenerateAlert();
      const questionnaireAlert = mockGenerateQuestionnaireResponse();

      const members = [mockGenerateMember()];
      spyOnServiceGetUserMembers.mockResolvedValue(members);
      spyOnServiceGetAlerts.mockResolvedValue([alert]);
      spyOnActionItemsServiceGetAlerts.mockResolvedValue([actionItemsAlert]);
      spyOnTodoServiceGetAlerts.mockResolvedValue([todoAlert]);
      spyOnAppointmentServiceGetAlerts.mockResolvedValue([appointmentAlert]);
      spyOnQuestionnareServiceGetAlerts.mockResolvedValue([questionnaireAlert]);
      spyOnJourneyServiceGetRecent.mockResolvedValue({ id: journeyId });

      const alerts = await resolver.getAlerts(userId, lastQueryAlert);

      expect(spyOnServiceGetAlerts).toBeCalledTimes(1);
      expect(spyOnServiceGetAlerts).toBeCalledWith(userId, members, lastQueryAlert);
      expect(alerts).toEqual([
        alert,
        actionItemsAlert,
        todoAlert,
        appointmentAlert,
        questionnaireAlert,
      ]);
    });
  });

  describe('handleAlertForQRSubmit', () => {
    let spyOnServiceGetMember: jest.SpyInstance;
    let spyOnUserServiceGetEscalationGroupUsers: jest.SpyInstance;
    let spyOnJourneyServiceGetRecent: jest.SpyInstance;

    beforeEach(() => {
      spyOnServiceGetMember = jest.spyOn(service, 'get');
      spyOnUserServiceGetEscalationGroupUsers = jest.spyOn(userService, 'getEscalationGroupUsers');
      spyOnJourneyServiceGetRecent = jest.spyOn(journeyService, 'getRecent');
    });

    afterEach(() => {
      spyOnServiceGetMember.mockReset();
      spyOnUserServiceGetEscalationGroupUsers.mockReset();
      spyOnJourneyServiceGetRecent.mockReset();
    });

    it('should handle alert for QR submit - escalation not required', async () => {
      const user = mockGenerateUser();
      const member = mockGenerateMember(user);
      const org = mockGenerateOrg();

      spyOnServiceGetMember.mockImplementationOnce(async () => member);
      spyOnJourneyServiceGetRecent.mockResolvedValueOnce({ id: generateId(), org });

      const params: IEventOnAlertForQRSubmit = {
        memberId: member.id,
        questionnaireName: lorem.word(),
        score: datatype.number().toString(),
        questionnaireResponseId: generateId(),
        questionnaireType: randomEnum(QuestionnaireType) as QuestionnaireType,
      };

      await resolver.handleAlertForQRSubmit(params);
      expect(spyOnEventEmitter).toHaveBeenCalledWith(GlobalEventType.notifySlack, {
        channel: 'slack.escalation',
        header: `*High Assessment Score [${org.name}]*`,
        icon: ':warning:',
        message:
          `Alerting results on ${params.questionnaireName} for ` +
          `${user.firstName} ${user.lastName}’s member - ` +
          `<${hosts.harmony}/details/${member.id}|` +
          `${member.firstName[0].toUpperCase() + member.lastName[0].toUpperCase()}>. Scored a '${
            params.score
          }'`,
      });
    });

    it('should handle alert for QR submit - escalation required', async () => {
      const user = mockGenerateUser();
      const member = mockGenerateMember(user);
      const org = mockGenerateOrg();

      spyOnServiceGetMember.mockImplementationOnce(async () => member);
      spyOnUserServiceGetEscalationGroupUsers.mockResolvedValue([user]);
      spyOnJourneyServiceGetRecent.mockResolvedValueOnce({ id: generateId(), org });

      const params: IEventOnAlertForQRSubmit = {
        memberId: member.id,
        questionnaireName: lorem.word(),
        score: QuestionnaireAlerts.get(QuestionnaireType.phq9),
        questionnaireResponseId: generateId(),
        questionnaireType: QuestionnaireType.phq9,
      };

      await resolver.handleAlertForQRSubmit(params);
      expect(spyOnEventEmitter).toHaveBeenNthCalledWith(1, GlobalEventType.notifySlack, {
        channel: 'slack.escalation',
        header: `*High Assessment Score [${org.name}]*`,
        icon: ':warning:',
        message:
          `Alerting results on ${params.questionnaireName} for ` +
          `${user.firstName} ${user.lastName}’s member - ` +
          `<${hosts.harmony}/details/${member.id}|` +
          `${
            member.firstName[0].toUpperCase() + member.lastName[0].toUpperCase()
          }>. Scored a '${QuestionnaireAlerts.get(QuestionnaireType.phq9)}'`,
      });

      const contentKey = AlertInternalKey.assessmentSubmitAlert;
      expect(spyOnEventEmitter).toHaveBeenNthCalledWith(2, EventType.notifyDispatch, {
        correlationId: expect.any(String),
        dispatchId: generateDispatchId(contentKey, params.questionnaireResponseId),
        notificationType: NotificationType.textSms,
        recipientClientId: user.id.toString(),
        senderClientId: member.id,
        contentKey,
        assessmentName: params.questionnaireName,
        assessmentScore: params.score.toString(),
      });
    });
  });

  describe('sendSmsToChat', () => {
    let spyOnServiceIsControlByPhone;
    let spyOnServiceGetByPhone;

    beforeEach(() => {
      spyOnServiceIsControlByPhone = jest.spyOn(service, 'isControlByPhone');
      spyOnServiceGetByPhone = jest.spyOn(service, 'getByPhone');
    });

    afterEach(() => {
      spyOnServiceIsControlByPhone.mockReset();
      spyOnServiceGetByPhone.mockReset();
    });

    it('should exit when control member sends an sms', async () => {
      spyOnServiceIsControlByPhone.mockResolvedValueOnce(true);
      const event: IEventOnReceivedTextMessage = {
        phone: generatePhone(),
        message: lorem.sentence(),
      };
      await resolver.sendSmsToChat(event);

      expect(spyOnServiceIsControlByPhone).toBeCalled();
      expect(spyOnServiceGetByPhone).not.toBeCalled();
    });

    it('should be handled when member sends an sms', async () => {
      spyOnServiceIsControlByPhone.mockResolvedValueOnce(false);
      const event: IEventOnReceivedTextMessage = {
        phone: generatePhone(),
        message: lorem.sentence(),
      };
      await resolver.sendSmsToChat(event);

      expect(spyOnServiceIsControlByPhone).toBeCalled();
      expect(spyOnServiceGetByPhone).toBeCalled();
    });
  });

  describe('getClient', () => {
    let spyOnServiceGet;
    let spyOnUserServiceGet;
    beforeEach(() => {
      spyOnServiceGet = jest.spyOn(service, 'get');
      spyOnUserServiceGet = jest.spyOn(userService, 'get');
    });

    afterEach(() => {
      spyOnServiceGet.mockReset();
      spyOnUserServiceGet.mockReset();
    });

    it('should get user', async () => {
      const user = mockGenerateUser();
      spyOnUserServiceGet.mockResolvedValueOnce(user);
      const result = await resolver.getClient(generateId());
      expect(spyOnUserServiceGet).toBeCalled();
      expect(spyOnServiceGet).not.toBeCalled();
      expect(result.id).toEqual(user.id);
      expect(result.firstName).toEqual(user.firstName);
      expect(result.lastName).toEqual(user.lastName);
    });

    it('should get member', async () => {
      const member = mockGenerateMember();
      spyOnServiceGet.mockResolvedValueOnce(member);
      const result = await resolver.getClient(generateId());
      expect(spyOnUserServiceGet).toBeCalled();
      expect(spyOnServiceGet).toBeCalled();
      expect(result.id).toEqual(member.id);
      expect(result.firstName).toEqual(member.firstName);
      expect(result.lastName).toEqual(member.lastName);
    });
  });

  /**************************************************************************************************
   ******************************************** Helpers *********************************************
   *************************************************************************************************/

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
});
