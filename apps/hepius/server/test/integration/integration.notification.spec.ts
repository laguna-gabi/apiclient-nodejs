import {
  AlertInternalKey,
  AppointmentInternalKey,
  ChatInternalKey,
  ContentKey,
  ExternalKey,
  InnerQueueTypes,
  JournalCustomKey,
  LogInternalKey,
  NotifyCustomKey,
  ObjectAppointmentScheduledClass,
  ObjectAssessmentSubmitAlertClass,
  ObjectBaseClass,
  ObjectCallOrVideoClass,
  ObjectCancelClass,
  ObjectChatMessageUserClass,
  ObjectCustomContentClass,
  ObjectExternalContentMobileClass,
  ObjectExternalContentWebScheduleAppointmentClass,
  ObjectFutureNotifyClass,
  ObjectJournalContentClass,
  ObjectNewChatMessageToMemberClass,
  ObjectNewMemberClass,
  ObjectNewMemberNudgeClass,
  ObjectRegisterMemberWithTriggeredClass,
  ObjectUpdateMemberOrgClass,
  ObjectUpdateMemberSettingsClass,
  ObjectUpdateSenderClientIdClass,
  RegisterInternalKey,
  TodoInternalKey,
  generateAppointmentScheduleLongReminderMock,
  generateAppointmentScheduleReminderMock,
  generateAppointmentScheduledMemberMock,
  generateAppointmentScheduledUserMock,
  generateAssessmentSubmitAlertMock,
  generateChatMessageUserMock,
  generateCreateTodoAppointmentMock,
  generateCreateTodoExploreMock,
  generateCreateTodoMedsMock,
  generateCreateTodoQuestionnaireMock,
  generateCreateTodoTodoMock,
  generateDeleteDispatchMock,
  generateDeleteTodoAppointmentMock,
  generateDeleteTodoMedsMock,
  generateDeleteTodoTodoMock,
  generateDispatchId,
  generateExternalContentMobileMock,
  generateExternalContentWebScheduleAppointmentMock,
  generateNewChatMessageToMemberMock,
  generateNewControlMemberMock,
  generateNewMemberMock,
  generateNewMemberNudgeMock,
  generateObjectCallOrVideoMock,
  generateObjectCancelMock,
  generateObjectCustomContentMock,
  generateObjectFutureNotifyMock,
  generateObjectJournalContentMock,
  generateObjectRegisterMemberWithTriggeredMock,
  generateRequestAppointmentMock,
  generateTextMessageUserMock,
  generateUpdateMemberOrgMock,
  generateUpdateMemberSettingsMock,
  generateUpdateSenderClientIdMock,
  generateUpdateTodoAppointmentMock,
  generateUpdateTodoMedsMock,
  generateUpdateTodoTodoMock,
  generateUpdateUserSettingsMock,
} from '@argus/irisClient';
import {
  CancelNotificationType,
  ClientCategory,
  NotificationType,
  Platform,
  QueueType,
} from '@argus/pandora';
import { general, hosts, scheduler } from 'config';
import { addDays, addSeconds, subDays, subMinutes } from 'date-fns';
import { datatype, date as fakerDate, internet, lorem } from 'faker';
import { v4 } from 'uuid';
import { BEFORE_ALL_TIMEOUT, generateRequestHeaders } from '..';
import {
  ItemType,
  RegisterForNotificationParams,
  delay,
  generatePath,
  reformatDate,
} from '../../src/common';
import { DailyReportCategoriesInput, DailyReportCategoryTypes } from '../../src/dailyReport';
import { CancelNotifyParams, NotifyParams } from '../../src/member';
import { AudioFormat, ImageFormat, UpdateJournalTextParams } from '../../src/journey';
import {
  AlertConditionType,
  CreateQuestionnaireParams,
  QuestionnaireAlerts,
  QuestionnaireType,
  SubmitQuestionnaireResponseParams,
} from '../../src/questionnaire';
import {
  ActionTodoLabel,
  CreateActionTodoParams,
  CreateTodoParams,
  TodoLabel,
  UpdateTodoParams,
} from '../../src/todo';
import { AppointmentsIntegrationActions, Creators, Handler } from '../aux';
import {
  generateCreateActionTodoParams,
  generateCreateMemberParams,
  generateCreateQuestionnaireParams,
  generateCreateTodoParams,
  generateDailyReport,
  generateDeleteMemberParams,
  generateNotifyContentParams,
  generateOrgParams,
  generateReplaceUserForMemberParams,
  generateRequestAppointmentParams,
  generateScheduleAppointmentParams,
  generateSubmitQuestionnaireResponseParams,
  generateUpdateJournalTextParams,
  generateUpdateMemberConfigParams,
  generateUpdateMemberParams,
  generateUpdateTodoParams,
  mockGenerateQuestionnaireItem,
} from '../generators';
import * as sendbirdPayload from '../unit/mocks/webhookSendbirdNewMessagePayload.json';
import { Appointment } from '@argus/hepiusClient';

// mock uuid.v4:
jest.mock('uuid', () => {
  const actualUUID = jest.requireActual('uuid');
  const mockV4 = jest.fn(actualUUID.v4);
  return { v4: mockV4 };
});

/**
 * Following all scenarios as defined here https://miro.com/app/board/o9J_lnJqa3w=/
 */
describe('Integration tests: notifications', () => {
  const handler: Handler = new Handler();
  let creators: Creators;
  let appointmentsActions: AppointmentsIntegrationActions;

  beforeAll(async () => {
    await handler.beforeAll();
    appointmentsActions = new AppointmentsIntegrationActions(
      handler.mutations,
      handler.defaultUserRequestHeaders,
    );
    creators = new Creators(handler, appointmentsActions);
    handler.queueService.spyOnQueueServiceSendMessage.mockReset(); //not interested in past events
  }, BEFORE_ALL_TIMEOUT);

  afterEach(() => {
    handler.queueService.spyOnQueueServiceSendMessage.mockReset();
  });

  afterAll(async () => {
    await handler.afterAll();
  });

  describe('Member', () => {
    afterEach(() => {
      handler.queueService.spyOnQueueServiceSendMessage.mockReset();
    });

    /**
     * Trigger : MemberResolver.createMember
     * Settings :
     *      1. update member settings : send event to queue on update member config (on create member)
     *      2. update user settings : send event to queue on update user config (on create user)
     * Dispatches:
     *      3. send newMember dispatch
     *      4. send newMemberNudge dispatch
     */
    // eslint-disable-next-line max-len
    it(`createMember: should updateClientSettings for user and member and send dispatch of type ${RegisterInternalKey.newMember} and ${RegisterInternalKey.newMemberNudge}`, async () => {
      const { member, user, org } = await creators.createMemberUserAndOptionalOrg();
      await delay(200);

      //send event to queue on update user config (create)
      const mockUser = generateUpdateUserSettingsMock(user);
      const objectUser = new ObjectUpdateMemberSettingsClass(mockUser);
      Object.keys(objectUser.objectUpdateMemberSettings).forEach((key) => {
        expectStringContaining(1, key, mockUser[key]);
      });

      //send event to queue on update member config (create)
      const mockMember = generateUpdateMemberSettingsMock({
        ...member,
        orgName: org.name,
      });
      const objectMember = new ObjectUpdateMemberSettingsClass(mockMember);
      Object.keys(objectMember.objectUpdateMemberSettings).forEach((key) => {
        if (key !== 'firstLoggedInAt') {
          expectStringContaining(2, key, mockMember[key]);
        }
      });

      const mock1 = generateNewMemberMock({
        recipientClientId: member.id,
        senderClientId: user.id,
      });
      const object1 = new ObjectNewMemberClass(mock1);
      Object.keys(object1.objectNewMemberMock).forEach((key) => {
        expect(handler.queueService.spyOnQueueServiceSendMessage).toHaveBeenNthCalledWith(
          3,
          expect.objectContaining({
            type: QueueType.notifications,
            message: expect.stringContaining(
              key === 'correlationId' || key === 'appointmentId' ? key : `"${key}":"${mock1[key]}"`,
            ),
          }),
        );
      });

      const mock2 = generateNewMemberNudgeMock({
        recipientClientId: member.id,
        senderClientId: user.id,
      });
      const object2 = new ObjectNewMemberNudgeClass(mock2);
      Object.keys(object2.objectNewMemberNudgeMock).forEach((key) => {
        expect(handler.queueService.spyOnQueueServiceSendMessage).toHaveBeenNthCalledWith(
          4,
          expect.objectContaining({
            type: QueueType.notifications,
            message: expect.stringContaining(
              key === 'correlationId' || key === 'appointmentId' || key === 'triggersAt'
                ? key
                : `"${key}":"${mock2[key]}"`,
            ),
          }),
        );
      });
    });

    /**
     * Trigger : MemberResolver.updateMember
     * Settings :
     *      1. update member settings : send event to queue on update member settings
     */
    it(`updateMember: should updateClientSettings for member`, async () => {
      const { member } = await creators.createMemberUserAndOptionalOrg();

      handler.queueService.spyOnQueueServiceSendMessage.mockReset();
      const updateMemberParams = generateUpdateMemberParams({ id: member.id });
      await handler.mutations.updateMember({ updateMemberParams });
      await delay(200);

      //send event to queue on update member
      const mockMember = generateUpdateMemberSettingsMock({
        ...updateMemberParams,
        phone: member.phone,
      });
      const objectMember = new ObjectUpdateMemberSettingsClass(mockMember);
      Object.keys(objectMember.objectUpdateMemberSettings).forEach((key) => {
        if (key !== 'firstLoggedInAt') {
          expectStringContaining(1, key, mockMember[key]);
        }
      });
    });

    /**
     * Trigger : MemberResolver.updateMemberConfig
     * Settings :
     *      1. update member settings : send event to queue on update member settings
     */
    it(`updateMemberConfig: should updateClientSettings for member`, async () => {
      const { member } = await creators.createMemberUserAndOptionalOrg();
      const requestHeaders = generateRequestHeaders(member.authId);

      handler.queueService.spyOnQueueServiceSendMessage.mockReset();
      const updateMemberConfigParams = generateUpdateMemberConfigParams();
      delete updateMemberConfigParams.memberId;
      await handler.mutations.updateMemberConfig({ updateMemberConfigParams, requestHeaders });
      await delay(200);

      //send event to queue on update member config
      const mockMember = generateUpdateMemberSettingsMock({
        ...updateMemberConfigParams,
      });
      const objectMember = new ObjectUpdateMemberSettingsClass(mockMember);
      Object.keys(objectMember.objectUpdateMemberSettings).forEach((key) => {
        if (key !== 'firstLoggedInAt') {
          expectStringContaining(1, key, mockMember[key]);
        }
      });
    });

    /**
     * Trigger : MemberResolver.deleteMember
     * Settings :
     *      1. delete member client settings
     * Dispatches :
     *      2. delete dispatch InternalKey.newMemberNudge
     *      3. delete dispatch InternalKey.newRegisteredMember
     *      4. delete dispatch InternalKey.newRegisteredMemberNudge
     *      5. delete dispatch InternalKey.logReminder
     *      6. delete dispatch InternalKey.customContent
     */
    test.each([true, false])(
      `should delete settings and ${RegisterInternalKey.newMemberNudge} dispatch`,
      async (hard) => {
        const { member } = await creators.createMemberUserAndOptionalOrg();
        await delay(200);
        handler.queueService.spyOnQueueServiceSendMessage.mockReset(); //not interested in past events
        const deleteMemberParams = generateDeleteMemberParams({ id: member.id, hard });
        await handler.mutations.deleteMember({ deleteMemberParams });
        await delay(200);

        expect(handler.queueService.spyOnQueueServiceSendMessage).toBeCalledTimes(6);
        checkDeleteDispatches(member.id, true, 1);
        checkValues(6, { type: InnerQueueTypes.deleteClientSettings, id: member.id });
      },
    );

    /**
     * Trigger : MemberResolver.registerMemberForNotifications
     * Settings :
     *      1. update member settings : send event to queue on update member config (create)
     * Dispatches :
     *      2. send newRegisteredMember dispatch (triggered in 1 day)
     *      3. send newRegisteredMemberNudge dispatch (triggered in 2 days)
     *      4. send logReminder dispatch (triggered in 3 days)
     */
    it(
      `registerMemberForNotifications: should update member settings and send dispatch of type ` +
        `${RegisterInternalKey.newRegisteredMember}, ` +
        `${RegisterInternalKey.newRegisteredMemberNudge}, ` +
        `${LogInternalKey.logReminder} and delete ` +
        `${RegisterInternalKey.newMemberNudge}`,
      async () => {
        const { member } = await creators.createMemberUserAndOptionalOrg();
        const requestHeaders = generateRequestHeaders(member.authId);

        await delay(200);
        handler.queueService.spyOnQueueServiceSendMessage.mockReset(); //not interested in past events

        const params: RegisterForNotificationParams = {
          platform: Platform.android,
          isPushNotificationsEnabled: true,
        };
        await handler.mutations.registerMemberForNotifications({
          requestHeaders,
          registerForNotificationParams: params,
        });

        await delay(200);

        const { firstLoggedInAt } = await handler.queries.getMemberConfig({
          id: member.id,
          requestHeaders,
        });

        expect(handler.queueService.spyOnQueueServiceSendMessage).toBeCalledTimes(5);

        expectStringContaining(1, 'platform', params.platform);
        expectStringContaining(1, 'isPushNotificationsEnabled', params.isPushNotificationsEnabled);
        expectStringContaining(1, 'firstLoggedInAt', firstLoggedInAt);

        const checkValues = (contentKey: ContentKey, amount: number) => {
          const mock1 = generateObjectRegisterMemberWithTriggeredMock({
            recipientClientId: member.id,
            senderClientId: member.primaryUserId.toString(),
            contentKey,
            triggersAt: addDays(new Date(), amount),
            notificationType: NotificationType.text,
          });
          const object1 = new ObjectRegisterMemberWithTriggeredClass(mock1);
          Object.keys(object1.objectRegisterMemberWithTriggeredType).forEach((key) => {
            expect(handler.queueService.spyOnQueueServiceSendMessage).toBeCalledWith(
              expect.objectContaining({
                type: QueueType.notifications,
                message: expect.stringContaining(
                  key === 'correlationId' || key === 'triggersAt'
                    ? key
                    : `"${key}":"${mock1[key]}"`,
                ),
              }),
            );
          });
        };

        checkValues(RegisterInternalKey.newRegisteredMember, 1);
        checkValues(RegisterInternalKey.newRegisteredMemberNudge, 2);
        checkValues(LogInternalKey.logReminder, 3);

        expectStringContaining(5, 'type', InnerQueueTypes.deleteDispatch);
        expectStringContaining(
          5,
          'dispatchId',
          generateDispatchId(RegisterInternalKey.newMemberNudge, member.id),
        );
      },
    );

    /**
     * Trigger : MemberResolver.registerMemberForNotifications
     * Settings :
     *      1. update member settings : send event to queue on update member config (create)
     */
    // eslint-disable-next-line max-len
    it('registerMemberForNotifications: should not re-send dispatches if member already logged in', async () => {
      const { member } = await creators.createMemberUserAndOptionalOrg();
      const requestHeaders = generateRequestHeaders(member.authId);

      await delay(200);

      const params: RegisterForNotificationParams = {
        platform: Platform.android,
        isPushNotificationsEnabled: true,
      };
      await handler.mutations.registerMemberForNotifications({
        requestHeaders,
        registerForNotificationParams: params,
      });

      await delay(200);
      handler.queueService.spyOnQueueServiceSendMessage.mockReset(); //not interested in past events

      //calling registerMemberForNotifications again
      const newParams: RegisterForNotificationParams = {
        platform: Platform.ios,
        isPushNotificationsEnabled: false,
      };
      await handler.mutations.registerMemberForNotifications({
        requestHeaders,
        registerForNotificationParams: newParams,
      });
      await delay(200);

      expect(handler.queueService.spyOnQueueServiceSendMessage).toBeCalledTimes(2);

      expectStringContaining(1, 'platform', newParams.platform);
      expectStringContaining(1, 'isPushNotificationsEnabled', newParams.isPushNotificationsEnabled);
      expectStringContaining(2, 'type', InnerQueueTypes.deleteDispatch);
      expectStringContaining(
        2,
        'dispatchId',
        generateDispatchId(RegisterInternalKey.newMemberNudge, member.id),
      );
    });

    /**
     * Trigger : MemberResolver.createControlMember
     * Settings :
     *      1. update member settings : send event to queue on update member config (on create control)
     * Dispatches:
     *      2. send newControlMember dispatch
     */
    // eslint-disable-next-line max-len
    it(`createControlMember: should updateClientSettings for member and send dispatch of type ${RegisterInternalKey.newControlMember}`, async () => {
      handler.featureFlagService.spyOnFeatureFlagControlGroup.mockImplementationOnce(
        async () => true,
      );
      const org = await creators.createAndValidateOrg();

      handler.queueService.spyOnQueueServiceSendMessage.mockReset(); //not interested in past events
      const memberParams = generateCreateMemberParams({ orgId: org.id });
      const { id } = await handler.mutations.createMember({ memberParams });

      await delay(200);

      // send event to queue on update member config (on create control)
      const updateControlMemberSettingsMock = {
        type: InnerQueueTypes.updateClientSettings,
        clientCategory: ClientCategory.member,
        id,
        firstName: memberParams.firstName,
        lastName: memberParams.lastName,
        zipCode: memberParams.zipCode,
        orgName: org.name,
      };
      const objectMember = new ObjectUpdateMemberSettingsClass(updateControlMemberSettingsMock);
      Object.keys(objectMember.objectUpdateMemberSettings).forEach((key) => {
        expectStringContaining(1, key, updateControlMemberSettingsMock[key]);
      });

      // send newControlMember dispatch
      const mockDispatch = generateNewControlMemberMock({ recipientClientId: id });
      const dispatchObject = new ObjectBaseClass(mockDispatch);
      Object.keys(dispatchObject.objectBaseType).forEach((key) => {
        expect(handler.queueService.spyOnQueueServiceSendMessage).toHaveBeenNthCalledWith(
          2,
          expect.objectContaining({
            type: QueueType.notifications,
            message: expect.stringContaining(
              key === 'correlationId' ? key : `"${key}":"${mockDispatch[key]}"`,
            ),
          }),
        );
      });
    });

    /**
     * Trigger : MemberResolver.notify
     * Dispatch :
     *      1. user sends member a custom dispatch to be triggered on specific time
     */
    it('notify: should register for future notify', async () => {
      const { member } = await creators.createMemberUserAndOptionalOrg();

      await delay(200);
      handler.queueService.spyOnQueueServiceSendMessage.mockReset(); //not interested in past events

      const when = addSeconds(new Date(), 1);
      const notifyParams: NotifyParams = {
        memberId: member.id,
        userId: member.primaryUserId.toString(),
        type: NotificationType.text,
        metadata: { content: lorem.word(), when },
      };
      await handler.mutations.notify({ notifyParams });

      await delay(200);

      const communication = await handler.communicationService.get({
        memberId: member.id,
        userId: member.primaryUserId.toString(),
      });
      const mock = generateObjectFutureNotifyMock({
        recipientClientId: member.id,
        senderClientId: member.primaryUserId.toString(),
        notificationType: notifyParams.type,
        triggersAt: when,
        sendBirdChannelUrl: communication.sendBirdChannelUrl,
        content: notifyParams.metadata.content,
      });
      const object = new ObjectFutureNotifyClass(mock);
      Object.keys(object.objectFutureNotifyType).forEach((key) => {
        expect(handler.queueService.spyOnQueueServiceSendMessage).toBeCalledWith(
          expect.objectContaining({
            type: QueueType.notifications,
            message: expect.stringContaining(
              key === 'correlationId' || key === 'triggersAt' || key === 'dispatchId'
                ? key
                : `"${key}":"${mock[key]}"`,
            ),
          }),
        );
      });
    });

    /**
     * Trigger : MemberResolver.notify
     * Dispatch :
     *      1. send customContent dispatch
     */
    it(`notify: dispatch message of type ${NotificationType.textSms}`, async () => {
      const { member } = await creators.createMemberUserAndOptionalOrg();

      await delay(200);
      handler.queueService.spyOnQueueServiceSendMessage.mockReset(); //not interested in past events

      const notifyParams: NotifyParams = {
        memberId: member.id,
        userId: member.primaryUserId.toString(),
        type: NotificationType.textSms,
        metadata: { content: lorem.word() },
      };
      await handler.mutations.notify({ notifyParams });

      await delay(200);

      const communication = await handler.communicationService.get({
        memberId: member.id,
        userId: member.primaryUserId.toString(),
      });
      const mock = generateObjectCustomContentMock({
        recipientClientId: notifyParams.memberId,
        senderClientId: notifyParams.userId,
        notificationType: notifyParams.type,
        content: notifyParams.metadata.content,
        sendBirdChannelUrl: communication.sendBirdChannelUrl,
      });
      const object = new ObjectCustomContentClass(mock);
      Object.keys(object.objectCustomContentType).forEach((key) => {
        expect(handler.queueService.spyOnQueueServiceSendMessage).toBeCalledWith(
          expect.objectContaining({
            type: QueueType.notifications,
            message: expect.stringContaining(
              key === 'correlationId' || key === 'dispatchId' ? key : `"${key}":"${mock[key]}"`,
            ),
          }),
        );
      });
    });

    /**
     * Trigger : MemberResolver.notify
     * Dispatch :
     *      1. send callOrVideo dispatch
     */
    test.each([NotificationType.video, NotificationType.call])(
      `notify: dispatch message of type %p`,
      async (type) => {
        const { member } = await creators.createMemberUserAndOptionalOrg();
        const requestHeaders = generateRequestHeaders(member.authId);

        const params: RegisterForNotificationParams = {
          platform: Platform.android,
          isPushNotificationsEnabled: true,
        };
        await handler.mutations.registerMemberForNotifications({
          requestHeaders,
          registerForNotificationParams: params,
        });

        await delay(500);
        handler.queueService.spyOnQueueServiceSendMessage.mockReset(); //not interested in past events

        const notifyParams: NotifyParams = {
          memberId: member.id,
          userId: member.primaryUserId.toString(),
          type,
          metadata: { peerId: datatype.uuid() },
        };
        await handler.mutations.notify({ notifyParams });

        await delay(200);

        const communication = await handler.communicationService.get({
          memberId: member.id,
          userId: member.primaryUserId.toString(),
        });
        const mock = generateObjectCallOrVideoMock({
          recipientClientId: notifyParams.memberId,
          senderClientId: notifyParams.userId,
          notificationType: notifyParams.type,
          peerId: notifyParams.metadata.peerId,
          path: generatePath(notifyParams.type),
          sendBirdChannelUrl: communication.sendBirdChannelUrl,
        });
        const object = new ObjectCallOrVideoClass(mock);
        Object.keys(object.objectCallOrVideoType).forEach((key) => {
          expect(handler.queueService.spyOnQueueServiceSendMessage).toBeCalledWith(
            expect.objectContaining({
              type: QueueType.notifications,
              message: expect.stringContaining(
                key === 'correlationId' || key === 'dispatchId' ? key : `"${key}":"${mock[key]}"`,
              ),
            }),
          );
        });
      },
    );

    /**
     * Trigger : MemberResolver.notifyContent
     * Dispatch :
     *      1. send ExternalKey dispatch of types ExternalKey.addCaregiverDetails or ExternalKey.setCallPermissions
     */
    test.each([ExternalKey.addCaregiverDetails, ExternalKey.setCallPermissions])(
      `notifyContent: dispatch message of %p`,
      async (contentKey) => {
        const { member } = await creators.createMemberUserAndOptionalOrg();
        const requestHeaders = generateRequestHeaders(member.authId);

        const params: RegisterForNotificationParams = {
          platform: Platform.android,
          isPushNotificationsEnabled: true,
        };
        await handler.mutations.registerMemberForNotifications({
          requestHeaders,
          registerForNotificationParams: params,
        });

        await delay(500);
        handler.queueService.spyOnQueueServiceSendMessage.mockReset(); //not interested in past events

        const notifyContentParams = generateNotifyContentParams({
          memberId: member.id,
          userId: member.primaryUserId.toString(),
          contentKey,
        });

        await handler.mutations.notifyContent({ notifyContentParams });
        await delay(200);

        const mock = generateExternalContentMobileMock({
          recipientClientId: notifyContentParams.memberId,
          senderClientId: notifyContentParams.userId,
          path: generatePath(NotificationType.text, contentKey),
          contentKey,
        });
        const object = new ObjectExternalContentMobileClass(mock);
        Object.keys(object.objectExternalContentMobileType).forEach((key) => {
          expect(handler.queueService.spyOnQueueServiceSendMessage).toBeCalledWith(
            expect.objectContaining({
              type: QueueType.notifications,
              message: expect.stringContaining(
                key === 'correlationId' || key === 'dispatchId' ? key : `"${key}":"${mock[key]}"`,
              ),
            }),
          );
        });
      },
    );

    /**
     * Trigger : MemberResolver.notifyContent
     * Dispatch :
     *      1. send ExternalKey dispatch of types ExternalKey.scheduleAppointment
     */
    it(`notifyContent: dispatch message of ${ExternalKey.scheduleAppointment}`, async () => {
      const { member } = await creators.createMemberUserAndOptionalOrg();

      handler.queueService.spyOnQueueServiceSendMessage.mockReset(); //not interested in past events

      const notifyContentParams = generateNotifyContentParams({
        memberId: member.id,
        userId: member.primaryUserId.toString(),
        contentKey: ExternalKey.scheduleAppointment,
      });

      await handler.mutations.notifyContent({ notifyContentParams });
      await delay(200);

      const mock = generateExternalContentWebScheduleAppointmentMock({
        recipientClientId: notifyContentParams.memberId,
        senderClientId: notifyContentParams.userId,
        scheduleLink: member.users[0].appointments[0].link,
      });
      const object = new ObjectExternalContentWebScheduleAppointmentClass(mock);
      Object.keys(object.objectExternalContentWebScheduleAppointmentType).forEach((key) => {
        expect(handler.queueService.spyOnQueueServiceSendMessage).toBeCalledWith(
          expect.objectContaining({
            type: QueueType.notifications,
            message: expect.stringContaining(
              key === 'correlationId' || key === 'dispatchId' ? key : `"${key}":"${mock[key]}"`,
            ),
          }),
        );
      });
    });

    /**
     * Trigger : MemberResolver.cancelNotify
     * Dispatch :
     *      1. send cancelVideo/cancelCall/cancelText dispatch
     */
    test.each([
      CancelNotificationType.cancelCall,
      CancelNotificationType.cancelText,
      CancelNotificationType.cancelVideo,
    ])(`notify: dispatch message of type %p`, async (type) => {
      const { member } = await creators.createMemberUserAndOptionalOrg();
      const requestHeaders = generateRequestHeaders(member.authId);

      const params: RegisterForNotificationParams = {
        platform: Platform.android,
        isPushNotificationsEnabled: true,
      };
      await handler.mutations.registerMemberForNotifications({
        requestHeaders,
        registerForNotificationParams: params,
      });

      await delay(500);
      handler.queueService.spyOnQueueServiceSendMessage.mockReset(); //not interested in past events

      const cancelNotifyParams: CancelNotifyParams = {
        memberId: member.id,
        type,
        metadata: { peerId: datatype.uuid() },
      };
      await handler.mutations.cancel({ cancelNotifyParams });

      await delay(200);

      const mock = generateObjectCancelMock({
        recipientClientId: cancelNotifyParams.memberId,
        notificationType: cancelNotifyParams.type,
        peerId: cancelNotifyParams.metadata.peerId,
      });
      const object = new ObjectCancelClass(mock);
      Object.keys(object.objectCancelType).forEach((key) => {
        expect(handler.queueService.spyOnQueueServiceSendMessage).toBeCalledWith(
          expect.objectContaining({
            type: QueueType.notifications,
            message: expect.stringContaining(
              key === 'correlationId' || key === 'dispatchId' ? key : `"${key}":"${mock[key]}"`,
            ),
          }),
        );
      });
    });

    /**
     * Trigger : MemberResolver.replaceUserForMember
     * Settings :
     *      1. create a member(only for the infra of the test)
     *      2. replace primary user for the member
     * Dispatches:
     *      3. send event for replace clients on messages
     */
    // eslint-disable-next-line max-len
    it(`replaceUserForMember: should updateSenderClientIdToRecipientClientId for member dispatches`, async () => {
      const { member, org } = await creators.createMemberUserAndOptionalOrg();
      const replacedUser = await creators.createAndValidateUser({ orgs: [org.id] });

      await delay(500);
      handler.queueService.spyOnQueueServiceSendMessage.mockReset(); //not interested in past events

      await handler.mutations.replaceUserForMember({
        replaceUserForMemberParams: generateReplaceUserForMemberParams({
          memberId: member.id,
          userId: replacedUser.id,
        }),
      });

      const mock = generateUpdateSenderClientIdMock({
        recipientClientId: member.id,
        senderClientId: replacedUser.id,
      });
      await delay(200);

      const object = new ObjectUpdateSenderClientIdClass(mock);
      Object.keys(object.updateSenderClientIdType).forEach((key) => {
        expect(handler.queueService.spyOnQueueServiceSendMessage).toBeCalledWith(
          expect.objectContaining({
            type: QueueType.notifications,
            message: expect.stringContaining(
              key === 'correlationId' ? key : `"${key}":"${mock[key]}"`,
            ),
          }),
        );
      });
    });

    it('replaceMemberOrg: should update client settings', async () => {
      const orgParams1 = generateOrgParams();
      const { id: orgId1 } = await handler.mutations.createOrg({ orgParams: orgParams1 });
      const orgParams2 = generateOrgParams();
      const { id: orgId2 } = await handler.mutations.createOrg({ orgParams: orgParams2 });

      const { member } = await creators.createMemberUserAndOptionalOrg({ orgId: orgId1 });

      await delay(500);
      handler.queueService.spyOnQueueServiceSendMessage.mockReset(); //not interested in past events

      await handler.mutations.replaceMemberOrg({
        replaceMemberOrgParams: { memberId: member.id, orgId: orgId2 },
      });
      await delay(200);

      const updatedOrgMemberMock = generateUpdateMemberOrgMock({
        id: member.id,
        orgName: orgParams2.name,
        zipCode: member.zipCode,
      });
      const objectMember = new ObjectUpdateMemberOrgClass(updatedOrgMemberMock);
      Object.keys(objectMember.objectUpdateMemberOrgType).forEach((key) => {
        expectStringContaining(1, key, updatedOrgMemberMock[key]);
      });
    });
  });

  describe('Appointment', () => {
    /**
     * Trigger : AppointmentBase.scheduleAppointment
     * Dispatches:
     *      1. delete dispatch InternalKey.newMemberNudge
     *      2. delete dispatch InternalKey.newRegisteredMember
     *      3. delete dispatch InternalKey.newRegisteredMemberNudge
     *      4. send a text sms message to user that appointment has been scheduled for him/her
     *      5. send a text sms message to member that appointment has been scheduled for him/her
     *      6. set up a reminder for the member 15 minutes before the appointment
     *      7. set up a reminder for the member 1 day before the appointment
     */
    it(
      `scheduleAppointment: should send dispatches of types: ` +
        `${AppointmentInternalKey.appointmentScheduledUser}, ` +
        `${AppointmentInternalKey.appointmentScheduledMember}, ` +
        `${AppointmentInternalKey.appointmentReminder}, ` +
        `${AppointmentInternalKey.appointmentLongReminder}` +
        ` and delete types ${RegisterInternalKey.newMemberNudge}, ` +
        `${RegisterInternalKey.newRegisteredMember}, ` +
        `${RegisterInternalKey.newRegisteredMemberNudge}`,
      async () => {
        const appointment = await generateScheduleAppointment(addDays(new Date(), 5));
        await delay(500);

        checkDeleteDispatches(appointment.memberId.toString());
        const baseParams = { appointmentId: appointment.id, appointmentTime: appointment.start };
        const mockForUser = generateAppointmentScheduledUserMock({
          recipientClientId: appointment.userId.toString(),
          senderClientId: appointment.memberId.toString(),
          ...baseParams,
        });
        const mockForMember = generateAppointmentScheduledMemberMock({
          recipientClientId: appointment.memberId.toString(),
          senderClientId: appointment.userId.toString(),
          ...baseParams,
        });
        const communication = await handler.queries.getCommunication({
          getCommunicationParams: {
            memberId: appointment.memberId.toString(),
            userId: appointment.userId.toString(),
          },
        });

        checkValues(4, mockForUser);
        checkValues(5, mockForMember);
        checkValues(
          6,
          generateAppointmentScheduleReminderMock({
            recipientClientId: appointment.memberId.toString(),
            senderClientId: appointment.userId.toString(),
            ...baseParams,
            triggersAt: subMinutes(new Date(appointment.start), scheduler.alertBeforeInMin),
            chatLink: communication.chat.memberLink,
          }),
        );
        checkValues(
          7,
          generateAppointmentScheduleLongReminderMock({
            recipientClientId: appointment.memberId.toString(),
            senderClientId: appointment.userId.toString(),
            ...baseParams,
            triggersAt: subDays(new Date(appointment.start), 1),
          }),
        );
      },
    );

    /**
     * Trigger : AppointmentBase.scheduleAppointment
     * Dispatches:
     *      1. delete dispatch InternalKey.newMemberNudge
     *      2. delete dispatch InternalKey.newRegisteredMember
     *      3. delete dispatch InternalKey.newRegisteredMemberNudge
     * Not sending create dispatches on past appointment
     */
    it(
      `scheduleAppointment: should only delete dispatches of types ` +
        `${RegisterInternalKey.newMemberNudge}, ` +
        `${RegisterInternalKey.newRegisteredMember}, ` +
        `${RegisterInternalKey.newRegisteredMemberNudge} on past appointment`,
      async () => {
        const appointment = await generateScheduleAppointment(subMinutes(new Date(), 1));
        await delay(1000);

        expect(handler.queueService.spyOnQueueServiceSendMessage).toBeCalledTimes(3);
        checkDeleteDispatches(appointment.memberId.toString());
      },
    );

    /**
     * Trigger : AppointmentResolver.endAppointment
     * Dispatches:
     *      1. delete dispatch InternalKey.appointmentReminder
     *      2. delete dispatch InternalKey.appointmentLongReminder
     */
    it(
      `endAppointment: should delete dispatches of types ` +
        `${AppointmentInternalKey.appointmentReminder},` +
        ` ${AppointmentInternalKey.appointmentLongReminder}`,
      async () => {
        const appointment = await generateScheduleAppointment();
        await delay(1000);
        handler.queueService.spyOnQueueServiceSendMessage.mockReset(); //not interested in past events

        await handler.mutations.endAppointment({ endAppointmentParams: { id: appointment.id } });
        await delay(500);

        expect(handler.queueService.spyOnQueueServiceSendMessage).toBeCalledTimes(2);
        checkValues(1, {
          type: InnerQueueTypes.deleteDispatch,
          dispatchId: generateDispatchId(
            AppointmentInternalKey.appointmentReminder,
            appointment.memberId.toString(),
            appointment.id,
          ),
        });
        checkValues(2, {
          type: InnerQueueTypes.deleteDispatch,
          dispatchId: generateDispatchId(
            AppointmentInternalKey.appointmentLongReminder,
            appointment.memberId.toString(),
            appointment.id,
          ),
        });
      },
    );

    /**
     * Trigger : AppointmentResolver.deleteAppointment
     * Dispatches:
     *      1. delete dispatch InternalKey.appointmentReminder
     *      2. delete dispatch InternalKey.appointmentLongReminder
     */
    it(
      `deleteAppointment: should delete dispatches of types ` +
        `${AppointmentInternalKey.appointmentReminder}, ` +
        `${AppointmentInternalKey.appointmentLongReminder}`,
      async () => {
        const appointment = await generateScheduleAppointment();
        await delay(1000);
        handler.queueService.spyOnQueueServiceSendMessage.mockReset();

        await handler.mutations.deleteAppointment({ id: appointment.id });
        await delay(500);

        expect(handler.queueService.spyOnQueueServiceSendMessage).toBeCalledTimes(2);
        checkValues(1, {
          type: InnerQueueTypes.deleteDispatch,
          dispatchId: generateDispatchId(
            AppointmentInternalKey.appointmentReminder,
            appointment.memberId.toString(),
            appointment.id,
          ),
        });
        checkValues(2, {
          type: InnerQueueTypes.deleteDispatch,
          dispatchId: generateDispatchId(
            AppointmentInternalKey.appointmentLongReminder,
            appointment.memberId.toString(),
            appointment.id,
          ),
        });
      },
    );

    /**
     * Trigger : AppointmentResolver.requestAppointment
     * Dispatches:
     *      1. send appointmentRequest dispatch
     */
    // eslint-disable-next-line max-len
    it(`requestAppointment: should send dispatch of type ${AppointmentInternalKey.appointmentRequest}`, async () => {
      const { member } = await creators.createMemberUserAndOptionalOrg();
      const fakeUUID = datatype.uuid();
      const appointmentParams = generateRequestAppointmentParams({
        userId: member.primaryUserId.toString(),
        memberId: member.id,
      });
      (v4 as jest.Mock).mockImplementationOnce(() => fakeUUID);
      const { id: appointmentId } = await handler.mutations.requestAppointment({
        appointmentParams,
      });

      await delay(200);

      const mock = generateRequestAppointmentMock({
        recipientClientId: member.id,
        senderClientId: member.primaryUserId.toString(),
        appointmentId,
        correlationId: fakeUUID,
        scheduleLink: `${hosts.get('app')}/${appointmentId}`,
      });

      expect(handler.queueService.spyOnQueueServiceSendMessage).toHaveBeenNthCalledWith(5, {
        message: JSON.stringify(mock, Object.keys(mock).sort()),
        type: QueueType.notifications,
      });
    });
  });

  describe('todo', () => {
    /**
     * Trigger : TodoResolver.createTodo
     * Dispatches:
     *      1. send createTodo dispatch
     */
    it(`createTodo: should send dispatch ${TodoInternalKey.createTodoMeds}`, async () => {
      const { member, user } = await creators.createMemberUserAndOptionalOrg();
      const memberId = member.id;

      await delay(200);
      handler.queueService.spyOnQueueServiceSendMessage.mockReset(); //not interested in past events

      const createTodoParams: CreateTodoParams = generateCreateTodoParams({
        memberId,
        label: TodoLabel.Meds,
      });

      const { id } = await handler.mutations.createTodo({
        requestHeaders: generateRequestHeaders(user.authId),
        createTodoParams,
      });
      await delay(200);

      const mock = generateCreateTodoMedsMock({
        recipientClientId: memberId,
        senderClientId: user.id,
        todoId: id,
      });

      const object = new ObjectBaseClass(mock);
      Object.keys(object.objectBaseType).forEach((key) => {
        expect(handler.queueService.spyOnQueueServiceSendMessage).toBeCalledWith(
          expect.objectContaining({
            type: QueueType.notifications,
            message: expect.stringContaining(
              key === 'correlationId' || key === 'dispatchId' ? key : `"${key}":"${mock[key]}"`,
            ),
          }),
        );
      });
    });

    /**
     * Trigger : TodoResolver.createTodo
     * Dispatches:
     *      1. send createTodo dispatch
     */
    it(`createTodo: should send dispatch ${TodoInternalKey.createTodoAppointment}`, async () => {
      const { member, user } = await creators.createMemberUserAndOptionalOrg();

      await delay(200);
      handler.queueService.spyOnQueueServiceSendMessage.mockReset(); //not interested in past events

      const createTodoParams: CreateTodoParams = generateCreateTodoParams({
        memberId: member.id,
        label: TodoLabel.Appointment,
      });

      const { id } = await handler.mutations.createTodo({
        requestHeaders: generateRequestHeaders(user.authId),
        createTodoParams,
      });
      await delay(200);

      const mock = generateCreateTodoAppointmentMock({
        recipientClientId: member.id,
        senderClientId: user.id,
        todoId: id,
      });

      const object = new ObjectBaseClass(mock);
      Object.keys(object.objectBaseType).forEach((key) => {
        expect(handler.queueService.spyOnQueueServiceSendMessage).toBeCalledWith(
          expect.objectContaining({
            type: QueueType.notifications,
            message: expect.stringContaining(
              key === 'correlationId' || key === 'dispatchId' ? key : `"${key}":"${mock[key]}"`,
            ),
          }),
        );
      });
    });

    /**
     * Trigger : TodoResolver.createTodo
     * Dispatches:
     *      1. send createTodo dispatch
     */
    it(`createTodo: should send dispatch ${TodoInternalKey.createTodoTodo}`, async () => {
      const { member, user } = await creators.createMemberUserAndOptionalOrg();

      await delay(200);
      handler.queueService.spyOnQueueServiceSendMessage.mockReset(); //not interested in past events

      const createTodoParams: CreateTodoParams = generateCreateTodoParams({
        memberId: member.id,
      });
      delete createTodoParams.label;

      const { id } = await handler.mutations.createTodo({
        requestHeaders: generateRequestHeaders(user.authId),
        createTodoParams,
      });
      await delay(200);

      const mock = generateCreateTodoTodoMock({
        recipientClientId: member.id,
        senderClientId: user.id,
        todoId: id,
      });

      const object = new ObjectBaseClass(mock);
      Object.keys(object.objectBaseType).forEach((key) => {
        expect(handler.queueService.spyOnQueueServiceSendMessage).toBeCalledWith(
          expect.objectContaining({
            type: QueueType.notifications,
            message: expect.stringContaining(
              key === 'correlationId' || key === 'dispatchId' ? key : `"${key}":"${mock[key]}"`,
            ),
          }),
        );
      });
    });

    /**
     * Trigger : TodoResolver.createActionTodo
     * Dispatches:
     *      1. send createTodo dispatch
     */
    // eslint-disable-next-line max-len
    it(`createActionTodo: should send dispatch ${TodoInternalKey.createTodoQuestionnaire}`, async () => {
      const { member, user } = await creators.createMemberUserAndOptionalOrg();

      await delay(200);
      handler.queueService.spyOnQueueServiceSendMessage.mockReset(); //not interested in past events

      const createActionTodoParams: CreateActionTodoParams = generateCreateActionTodoParams({
        memberId: member.id,
        label: ActionTodoLabel.Questionnaire,
      });

      const { id } = await handler.mutations.createActionTodo({
        requestHeaders: generateRequestHeaders(user.authId),
        createActionTodoParams,
      });
      await delay(200);

      const mock = generateCreateTodoQuestionnaireMock({
        recipientClientId: member.id,
        senderClientId: user.id,
        todoId: id,
      });

      const object = new ObjectBaseClass(mock);
      Object.keys(object.objectBaseType).forEach((key) => {
        expect(handler.queueService.spyOnQueueServiceSendMessage).toBeCalledWith(
          expect.objectContaining({
            type: QueueType.notifications,
            message: expect.stringContaining(
              key === 'correlationId' || key === 'dispatchId' ? key : `"${key}":"${mock[key]}"`,
            ),
          }),
        );
      });
    });

    /**
     * Trigger : TodoResolver.createActionTodo
     * Dispatches:
     *      1. send createTodo dispatch
     */
    it(`createActionTodo: should send dispatch ${TodoInternalKey.createTodoExplore}`, async () => {
      const { member, user } = await creators.createMemberUserAndOptionalOrg();

      await delay(200);
      handler.queueService.spyOnQueueServiceSendMessage.mockReset(); //not interested in past events

      const createActionTodoParams: CreateActionTodoParams = generateCreateActionTodoParams({
        memberId: member.id,
        label: ActionTodoLabel.Explore,
      });

      const { id } = await handler.mutations.createActionTodo({
        requestHeaders: generateRequestHeaders(user.authId),
        createActionTodoParams,
      });
      await delay(200);

      const mock = generateCreateTodoExploreMock({
        recipientClientId: member.id,
        senderClientId: user.id,
        todoId: id,
      });

      const object = new ObjectBaseClass(mock);
      Object.keys(object.objectBaseType).forEach((key) => {
        expect(handler.queueService.spyOnQueueServiceSendMessage).toBeCalledWith(
          expect.objectContaining({
            type: QueueType.notifications,
            message: expect.stringContaining(
              key === 'correlationId' || key === 'dispatchId' ? key : `"${key}":"${mock[key]}"`,
            ),
          }),
        );
      });
    });

    /**
     * Trigger : TodoResolver.createActionTodo
     * Dispatches:
     *      1. send createTodo dispatch
     */
    test.each([ActionTodoLabel.Journal, ActionTodoLabel.Scanner])(
      `createActionTodo: should send dispatch ${TodoInternalKey.createTodoExplore}`,
      async (label) => {
        const { member, user } = await creators.createMemberUserAndOptionalOrg();

        await delay(200);
        handler.queueService.spyOnQueueServiceSendMessage.mockReset(); //not interested in past events

        const createActionTodoParams: CreateActionTodoParams = generateCreateActionTodoParams({
          memberId: member.id,
          label,
        });

        const { id } = await handler.mutations.createActionTodo({
          requestHeaders: generateRequestHeaders(user.authId),
          createActionTodoParams,
        });
        await delay(200);

        const mock = generateCreateTodoTodoMock({
          recipientClientId: member.id,
          senderClientId: user.id,
          todoId: id,
        });

        const object = new ObjectBaseClass(mock);
        Object.keys(object.objectBaseType).forEach((key) => {
          expect(handler.queueService.spyOnQueueServiceSendMessage).toBeCalledWith(
            expect.objectContaining({
              type: QueueType.notifications,
              message: expect.stringContaining(
                key === 'correlationId' || key === 'dispatchId' ? key : `"${key}":"${mock[key]}"`,
              ),
            }),
          );
        });
      },
    );

    /**
     * Trigger : TodoResolver.updateTodo
     * Dispatches:
     *      1. send updateTodo dispatch
     */
    it(`updateTodo: should send dispatch ${TodoInternalKey.updateTodoMeds}`, async () => {
      const { member, user } = await creators.createMemberUserAndOptionalOrg();
      const requestHeaders = generateRequestHeaders(user.authId);

      await delay(200);

      const createTodoParams: CreateTodoParams = generateCreateTodoParams({
        memberId: member.id,
      });

      const { id: oldTodoId } = await handler.mutations.createTodo({
        requestHeaders,
        createTodoParams,
      });

      await delay(200);
      handler.queueService.spyOnQueueServiceSendMessage.mockReset(); //not interested in past events

      const updateTodoParams: UpdateTodoParams = generateUpdateTodoParams({
        id: oldTodoId,
        memberId: member.id,
        label: TodoLabel.Meds,
      });

      const { id } = await handler.mutations.updateTodo({
        requestHeaders,
        updateTodoParams,
      });

      await delay(200);

      const mock = generateUpdateTodoMedsMock({
        recipientClientId: member.id,
        senderClientId: user.id,
        todoId: id,
      });

      const object = new ObjectBaseClass(mock);
      Object.keys(object.objectBaseType).forEach((key) => {
        expect(handler.queueService.spyOnQueueServiceSendMessage).toBeCalledWith(
          expect.objectContaining({
            type: QueueType.notifications,
            message: expect.stringContaining(
              key === 'correlationId' || key === 'dispatchId' ? key : `"${key}":"${mock[key]}"`,
            ),
          }),
        );
      });
    });

    /**
     * Trigger : TodoResolver.updateTodo
     * Dispatches:
     *      1. send updateTodo dispatch
     */
    it(`updateTodo: should send dispatch ${TodoInternalKey.updateTodoAppointment}`, async () => {
      const { member, user } = await creators.createMemberUserAndOptionalOrg();
      const requestHeaders = generateRequestHeaders(user.authId);

      await delay(200);

      const createTodoParams: CreateTodoParams = generateCreateTodoParams({
        memberId: member.id,
      });

      const { id: oldTodoId } = await handler.mutations.createTodo({
        requestHeaders,
        createTodoParams,
      });

      await delay(200);
      handler.queueService.spyOnQueueServiceSendMessage.mockReset(); //not interested in past events

      const updateTodoParams: UpdateTodoParams = generateUpdateTodoParams({
        id: oldTodoId,
        memberId: member.id,
        label: TodoLabel.Appointment,
      });

      const { id } = await handler.mutations.updateTodo({
        requestHeaders,
        updateTodoParams,
      });

      await delay(200);

      const mock = generateUpdateTodoAppointmentMock({
        recipientClientId: member.id,
        senderClientId: user.id,
        todoId: id,
      });

      const object = new ObjectBaseClass(mock);
      Object.keys(object.objectBaseType).forEach((key) => {
        expect(handler.queueService.spyOnQueueServiceSendMessage).toBeCalledWith(
          expect.objectContaining({
            type: QueueType.notifications,
            message: expect.stringContaining(
              key === 'correlationId' || key === 'dispatchId' ? key : `"${key}":"${mock[key]}"`,
            ),
          }),
        );
      });
    });

    /**
     * Trigger : TodoResolver.updateTodo
     * Dispatches:
     *      1. send updateTodo dispatch
     */
    it(`updateTodo: should send dispatch ${TodoInternalKey.updateTodoTodo}`, async () => {
      const { member, user } = await creators.createMemberUserAndOptionalOrg();
      const requestHeaders = generateRequestHeaders(user.authId);

      await delay(200);

      const createTodoParams: CreateTodoParams = generateCreateTodoParams({
        memberId: member.id,
      });

      const { id: oldTodoId } = await handler.mutations.createTodo({
        requestHeaders,
        createTodoParams,
      });

      await delay(200);
      handler.queueService.spyOnQueueServiceSendMessage.mockReset(); //not interested in past events

      const updateTodoParams: UpdateTodoParams = generateUpdateTodoParams({
        id: oldTodoId,
        memberId: member.id,
      });
      delete updateTodoParams.label;

      const { id } = await handler.mutations.updateTodo({
        updateTodoParams,
        requestHeaders,
      });

      await delay(200);

      const mock = generateUpdateTodoTodoMock({
        recipientClientId: member.id,
        senderClientId: user.id,
        todoId: id,
      });

      const object = new ObjectBaseClass(mock);
      Object.keys(object.objectBaseType).forEach((key) => {
        expect(handler.queueService.spyOnQueueServiceSendMessage).toBeCalledWith(
          expect.objectContaining({
            type: QueueType.notifications,
            message: expect.stringContaining(
              key === 'correlationId' || key === 'dispatchId' ? key : `"${key}":"${mock[key]}"`,
            ),
          }),
        );
      });
    });

    /**
     * Trigger : TodoResolver.deleteTodo
     * Dispatches:
     *      1. send deleteTodo dispatch
     */
    it(`deleteTodo: should send dispatch ${TodoInternalKey.deleteTodoMeds}`, async () => {
      const { member, user } = await creators.createMemberUserAndOptionalOrg();
      const requestHeaders = generateRequestHeaders(user.authId);

      await delay(200);

      const createTodoParams: CreateTodoParams = generateCreateTodoParams({
        memberId: member.id,
        label: TodoLabel.Meds,
      });

      const { id } = await handler.mutations.createTodo({
        requestHeaders,
        createTodoParams,
      });

      await delay(200);
      handler.queueService.spyOnQueueServiceSendMessage.mockReset(); //not interested in past events

      await handler.mutations.endTodo({
        id,
        requestHeaders,
      });

      await delay(200);

      const mock = generateDeleteTodoMedsMock({
        recipientClientId: member.id,
        senderClientId: user.id,
        todoId: id,
      });

      const object = new ObjectBaseClass(mock);
      Object.keys(object.objectBaseType).forEach((key) => {
        expect(handler.queueService.spyOnQueueServiceSendMessage).toBeCalledWith(
          expect.objectContaining({
            type: QueueType.notifications,
            message: expect.stringContaining(
              key === 'correlationId' || key === 'dispatchId' ? key : `"${key}":"${mock[key]}"`,
            ),
          }),
        );
      });
    });

    /**
     * Trigger : TodoResolver.deleteTodo
     * Dispatches:
     *      1. send deleteTodo dispatch
     */
    it(`deleteTodo: should send dispatch ${TodoInternalKey.deleteTodoAppointment}`, async () => {
      const { member, user } = await creators.createMemberUserAndOptionalOrg();
      const requestHeaders = generateRequestHeaders(user.authId);

      await delay(200);

      const createTodoParams: CreateTodoParams = generateCreateTodoParams({
        memberId: member.id,
        label: TodoLabel.Appointment,
      });

      const { id } = await handler.mutations.createTodo({
        requestHeaders,
        createTodoParams,
      });

      await delay(200);
      handler.queueService.spyOnQueueServiceSendMessage.mockReset(); //not interested in past events

      await handler.mutations.endTodo({ id, requestHeaders });

      await delay(200);

      const mock = generateDeleteTodoAppointmentMock({
        recipientClientId: member.id,
        senderClientId: user.id,
        todoId: id,
      });

      const object = new ObjectBaseClass(mock);
      Object.keys(object.objectBaseType).forEach((key) => {
        expect(handler.queueService.spyOnQueueServiceSendMessage).toBeCalledWith(
          expect.objectContaining({
            type: QueueType.notifications,
            message: expect.stringContaining(
              key === 'correlationId' || key === 'dispatchId' ? key : `"${key}":"${mock[key]}"`,
            ),
          }),
        );
      });
    });

    /**
     * Trigger : TodoResolver.deleteTodo
     * Dispatches:
     *      1. send deleteTodo dispatch
     */
    it(`deleteTodo: should send dispatch ${TodoInternalKey.deleteTodoTodo}`, async () => {
      const { member, user } = await creators.createMemberUserAndOptionalOrg();
      const requestHeaders = generateRequestHeaders(user.authId);

      await delay(200);

      const createTodoParams: CreateTodoParams = generateCreateTodoParams({
        memberId: member.id,
      });
      delete createTodoParams.label;

      const { id } = await handler.mutations.createTodo({
        requestHeaders,
        createTodoParams,
      });

      await delay(200);
      handler.queueService.spyOnQueueServiceSendMessage.mockReset(); //not interested in past events

      await handler.mutations.endTodo({ id, requestHeaders });

      await delay(200);

      const mock = generateDeleteTodoTodoMock({
        recipientClientId: member.id,
        senderClientId: user.id,
        todoId: id,
      });

      const object = new ObjectBaseClass(mock);
      Object.keys(object.objectBaseType).forEach((key) => {
        expect(handler.queueService.spyOnQueueServiceSendMessage).toBeCalledWith(
          expect.objectContaining({
            type: QueueType.notifications,
            message: expect.stringContaining(
              key === 'correlationId' || key === 'dispatchId' ? key : `"${key}":"${mock[key]}"`,
            ),
          }),
        );
      });
    });
  });

  describe('questionnaires', () => {
    /**
     * Trigger : QuestionnaireResolver.submitQuestionnaireResponse (on PHQ-9 alert)
     * Dispatches:
     *      1. send assessmentSubmitAlert dispatch
     */
    let spyOnUserServiceGetEscalationGroupUsers: jest.SpyInstance;

    beforeAll(() => {
      spyOnUserServiceGetEscalationGroupUsers = jest.spyOn(
        handler.userService,
        'getEscalationGroupUsers',
      );
    });

    afterAll(() => {
      spyOnUserServiceGetEscalationGroupUsers.mockReset();
    });

    // eslint-disable-next-line max-len
    it(`submitQuestionnaireResponse: should send dispatch ${AlertInternalKey.assessmentSubmitAlert}`, async () => {
      const { member, user } = await creators.createMemberUserAndOptionalOrg();
      const alertValue = datatype.number();
      const assessmentName = lorem.word();

      handler.queueService.spyOnQueueServiceSendMessage.mockReset(); //not interested in past events

      const createQuestionnaireParams: CreateQuestionnaireParams =
        generateCreateQuestionnaireParams({
          type: QuestionnaireType.phq9, // type of form to calculate a score
          shortName: assessmentName,
          items: [
            mockGenerateQuestionnaireItem({
              type: ItemType.choice,
              code: 'q1',
              options: [
                { label: QuestionnaireAlerts.get(QuestionnaireType.phq9), value: alertValue },
              ],
              alertCondition: [{ type: AlertConditionType.equal, value: alertValue.toString() }],
            }),
          ],
        });

      const { id: questionnaireId } = await handler.mutations.createQuestionnaire({
        createQuestionnaireParams,
      });

      // we want to control the escalation group before we send the notifications
      spyOnUserServiceGetEscalationGroupUsers.mockResolvedValue([{ id: user.id }]);

      const submitQuestionnaireResponseParams: SubmitQuestionnaireResponseParams =
        generateSubmitQuestionnaireResponseParams({
          questionnaireId,
          memberId: member.id,
          answers: [{ code: 'q1', value: alertValue.toString() }],
        });

      const { id } = await handler.mutations.submitQuestionnaireResponse({
        requestHeaders: generateRequestHeaders(user.authId),
        submitQuestionnaireResponseParams,
      });
      await delay(200);

      const mock = generateAssessmentSubmitAlertMock({
        recipientClientId: user.id,
        senderClientId: member.id,
        assessmentName,
        assessmentScore: QuestionnaireAlerts.get(QuestionnaireType.phq9),
        assessmentId: id,
      });

      const object = new ObjectAssessmentSubmitAlertClass(mock);
      Object.keys(object.objectAssessmentSubmitAlertMock).forEach((key) => {
        expect(handler.queueService.spyOnQueueServiceSendMessage).toBeCalledWith(
          expect.objectContaining({
            type: QueueType.notifications,
            message: expect.stringContaining(
              key === 'correlationId' || key === 'dispatchId' ? key : `"${key}":"${mock[key]}"`,
            ),
          }),
        );
      });
    });
  });

  /**
   * Trigger : MemberResolver.publishJournal
   * Dispatches:
   *      1. create dispatch CustomKey.journalContent having at least a content and/or links
   *          content
   *          journalImageDownloadLink
   *          journalAudioDownloadLink
   */
  test.each`
    audioLink | imageLink | description
    ${false}  | ${false}  | ${'having content'}
    ${true}   | ${true}   | ${'having content, journalImageDownloadLink, journalAudioDownloadLink'}
    ${false}  | ${true}   | ${'having content, journalImageDownloadLink'}
    ${true}   | ${false}  | ${'having content, journalAudioDownloadLink'}
  `(
    `publishJournal: should create dispatches of types ` +
      `${JournalCustomKey.journalContent} $description`,
    async (params) => {
      const { member } = await creators.createMemberUserAndOptionalOrg();
      const requestHeaders = generateRequestHeaders(member.authId);

      await delay(200);

      const { id: journalId } = await handler.mutations.createJournal({ requestHeaders });
      const updateJournalTextParams: UpdateJournalTextParams = generateUpdateJournalTextParams({
        id: journalId,
      });
      const journal = await handler.mutations.updateJournalText({
        requestHeaders,
        updateJournalTextParams,
      });

      const { journalAudioDownloadLink, journalImageDownloadLink } = await generateLinksMocks({
        params,
        journalId,
        requestHeaders,
      });

      handler.queueService.spyOnQueueServiceSendMessage.mockReset(); //not interested in past events

      await handler.mutations.publishJournal({ id: journalId, requestHeaders });

      await delay(500);

      const communication = await handler.communicationService.get({
        memberId: member.id,
        userId: member.primaryUserId.toString(),
      });
      const mock = generateObjectJournalContentMock({
        senderClientId: member.id,
        recipientClientId: member.primaryUserId.toString(),
        content: journal.text,
        sendBirdChannelUrl: communication.sendBirdChannelUrl,
        journalAudioDownloadLink,
        journalImageDownloadLink,
      });

      const object = new ObjectJournalContentClass(mock);
      Object.keys(object.objectCustomContentType).forEach((key) => {
        expect(handler.queueService.spyOnQueueServiceSendMessage).toBeCalledWith(
          expect.objectContaining({
            type: QueueType.notifications,
            message: expect.stringContaining(
              key === 'correlationId' || key === 'dispatchId' ? key : `"${key}":"${mock[key]}"`,
            ),
          }),
        );
      });
    },
  );

  const generateLinksMocks = async ({
    params,
    journalId,
    requestHeaders,
  }): Promise<{ journalAudioDownloadLink; journalImageDownloadLink }> => {
    let journalImageDownloadLink, journalAudioDownloadLink;

    if (params.imageLink) {
      const link = internet.url();
      handler.storage.spyOnStorageUpload.mockReturnValueOnce(link);
      handler.storage.spyOnStorageDownload.mockReturnValueOnce(link);

      const { normalImageLink } = await handler.queries.getMemberUploadJournalImageLink({
        requestHeaders,
        getMemberUploadJournalImageLinkParams: {
          id: journalId,
          imageFormat: ImageFormat.jpg,
        },
      });
      journalImageDownloadLink = normalImageLink;
    }
    if (params.audioLink) {
      const link = internet.url();
      handler.storage.spyOnStorageUpload.mockReturnValueOnce(link);
      handler.storage.spyOnStorageDownload.mockReturnValueOnce(link);

      const { audioLink } = await handler.queries.getMemberUploadJournalAudioLink({
        requestHeaders,
        getMemberUploadJournalAudioLinkParams: {
          id: journalId,
          audioFormat: AudioFormat.mp3,
        },
      });
      journalAudioDownloadLink = audioLink;
    }

    return { journalImageDownloadLink, journalAudioDownloadLink };
  };

  describe('Webhooks', () => {
    /**
     * Trigger : WebhooksController.sendbird
     * Dispatches:
     *      1. InternalKey.newChatMessageFromMember
     */
    /* eslint-disable max-len */
    it(`sendbird: should send dispatches of type ${ChatInternalKey.newChatMessageFromMember} when received from sendbird webhook`, async () => {
      /* eslint-enable max-len */
      const { member } = await creators.createMemberUserAndOptionalOrg();

      const communication = await handler.communicationService.get({
        memberId: member.id,
        userId: member.primaryUserId.toString(),
      });

      const payload = { ...sendbirdPayload };
      payload.sender.user_id = member.id;
      payload.channel.channel_url = communication.sendBirdChannelUrl;

      const spyOnValidate = jest.spyOn(
        handler.webhooksController,
        'validateMessageSentFromSendbird',
      );
      spyOnValidate.mockReturnValueOnce(undefined);
      handler.queueService.spyOnQueueServiceSendMessage.mockReset(); //not interested in past events

      await handler.webhooksController.sendbird(JSON.stringify(payload), {});
      await delay(200);

      const mock = generateTextMessageUserMock({
        recipientClientId: member.primaryUserId.toString(),
        senderClientId: member.id,
        contentKey: ChatInternalKey.newChatMessageFromMember,
      });

      const object = new ObjectBaseClass(mock);
      Object.keys(object.objectBaseType).forEach((key) => {
        expect(handler.queueService.spyOnQueueServiceSendMessage).toBeCalledWith(
          expect.objectContaining({
            type: QueueType.notifications,
            message: expect.stringContaining(
              key === 'correlationId' || key === 'dispatchId' ? key : `"${key}":"${mock[key]}"`,
            ),
          }),
        );
      });
    });

    /**
     * Trigger : WebhooksController.sendbird
     * Dispatches:
     *      1. InternalKey.newChatMessageFromUser
     */
    /* eslint-disable max-len */
    it(`sendbird: should send dispatches of type ${ChatInternalKey.newChatMessageFromUser} when received from sendbird webhook`, async () => {
      /* eslint-enable max-len */
      const { member } = await creators.createMemberUserAndOptionalOrg();

      const communication = await handler.communicationService.get({
        memberId: member.id,
        userId: member.primaryUserId.toString(),
      });

      const payload = { ...sendbirdPayload };
      payload.sender.user_id = member.primaryUserId.toString();
      payload.channel.channel_url = communication.sendBirdChannelUrl;

      const spyOnValidate = jest.spyOn(
        handler.webhooksController,
        'validateMessageSentFromSendbird',
      );
      spyOnValidate.mockReturnValueOnce(undefined);
      handler.queueService.spyOnQueueServiceSendMessage.mockReset(); //not interested in past events

      await handler.webhooksController.sendbird(JSON.stringify(payload), {});
      await delay(200);

      const mock = generateNewChatMessageToMemberMock({
        recipientClientId: member.id,
        senderClientId: member.primaryUserId.toString(),
      });

      const object = new ObjectNewChatMessageToMemberClass(mock);
      Object.keys(object.objectNewChatMessageFromUserType).forEach((key) => {
        expect(handler.queueService.spyOnQueueServiceSendMessage).toBeCalledWith(
          expect.objectContaining({
            type: QueueType.notifications,
            message: expect.stringContaining(
              key === 'correlationId' || key === 'dispatchId' ? key : `"${key}":"${mock[key]}"`,
            ),
          }),
        );
      });
    });

    // eslint-disable-next-line max-len
    it(`twilio: should send dispatches of type ${NotifyCustomKey.customContent} and content from the sms message`, async () => {
      const { member } = await creators.createMemberUserAndOptionalOrg();

      await delay(200);
      handler.queueService.spyOnQueueServiceSendMessage.mockReset(); //not interested in past events

      const payload = { Body: lorem.word(), From: member.phone, Token: 'token' };
      await handler.webhooksController.incomingSms(payload);
      await delay(200);

      const communication = await handler.communicationService.get({
        memberId: member.id,
        userId: member.primaryUserId.toString(),
      });
      const mock = generateChatMessageUserMock({
        recipientClientId: member.primaryUserId.toString(),
        senderClientId: member.id,
        content: payload.Body,
        sendBirdChannelUrl: communication.sendBirdChannelUrl,
      });

      const object = new ObjectChatMessageUserClass(mock);
      Object.keys(object.objectChatMessageUserType).forEach((key) => {
        expect(handler.queueService.spyOnQueueServiceSendMessage).toBeCalledWith(
          expect.objectContaining({
            type: QueueType.notifications,
            message: expect.stringContaining(
              key === 'correlationId' || key === 'dispatchId' ? key : `"${key}":"${mock[key]}"`,
            ),
          }),
        );
      });
    });

    /**
     * Trigger : DailyReportResolver.setDailyReportCategories
     * Dispatches:
     *      1. send memberNotFeelingWellMessage dispatch
     */
    /* eslint-disable max-len */
    it(`setDailyReportCategories: should send dispatch ${LogInternalKey.memberNotFeelingWellMessage}`, async () => {
      /* eslint-enable max-len */
      const { member } = await creators.createMemberUserAndOptionalOrg();

      await delay(200);
      handler.queueService.spyOnQueueServiceSendMessage.mockReset(); //not interested in past events

      jest
        .spyOn(handler.dailyReportService, 'setDailyReportCategories')
        .mockImplementation(async () =>
          generateDailyReport({ statsOverThreshold: [DailyReportCategoryTypes.Pain] }),
        );

      await handler.mutations // .setContextUserId(member.id, member.primaryUserId.toString())
        .setDailyReportCategories({
          requestHeaders: generateRequestHeaders(member.authId),
          dailyReportCategoriesInput: {
            date: reformatDate(fakerDate.recent().toString(), general.get('dateFormatString')),
            categories: [{ category: DailyReportCategoryTypes.Pain, rank: 1 }],
          } as DailyReportCategoriesInput,
        });
      await delay(200);

      const mock = generateTextMessageUserMock({
        senderClientId: member.id,
        recipientClientId: member.primaryUserId.toString(),
        contentKey: LogInternalKey.memberNotFeelingWellMessage,
      });

      const object = new ObjectBaseClass(mock);
      Object.keys(object.objectBaseType).forEach((key) => {
        expect(handler.queueService.spyOnQueueServiceSendMessage).toBeCalledWith(
          expect.objectContaining({
            type: QueueType.notifications,
            message: expect.stringContaining(
              key === 'correlationId' || key === 'dispatchId' ? key : `"${key}":"${mock[key]}"`,
            ),
          }),
        );
      });
    });
  });

  /*************************************************************************************************
   ******************************************** Helpers ********************************************
   ************************************************************************************************/
  const generateScheduleAppointment = async (start?: Date): Promise<Appointment> => {
    const { member } = await creators.createMemberUserAndOptionalOrg();

    await delay(200);
    handler.queueService.spyOnQueueServiceSendMessage.mockReset(); //not interested in past events

    const appointmentParams = generateScheduleAppointmentParams({
      userId: member.primaryUserId.toString(),
      memberId: member.id,
      start,
    });
    return handler.mutations.scheduleAppointment({ appointmentParams });
  };

  const checkValues = (index: number, mock) => {
    const object = new ObjectAppointmentScheduledClass(mock);
    Object.keys(object.objectAppointmentScheduledType).forEach((key) => {
      expect(handler.queueService.spyOnQueueServiceSendMessage).toHaveBeenNthCalledWith(
        index,
        expect.objectContaining({
          type: QueueType.notifications,
          message: expect.stringContaining(
            key === 'correlationId' || key === 'appointmentTime' || key === 'triggersAt'
              ? key
              : `"${key}":"${mock[key]}"`,
          ),
        }),
      );
    });
  };

  const checkDeleteDispatches = (memberId: string, withLogReminder = false, startFromIndex = 1) => {
    checkValues(
      startFromIndex,
      generateDeleteDispatchMock({
        dispatchId: generateDispatchId(RegisterInternalKey.newMemberNudge, memberId),
      }),
    );
    checkValues(
      startFromIndex + 1,
      generateDeleteDispatchMock({
        dispatchId: generateDispatchId(RegisterInternalKey.newRegisteredMember, memberId),
      }),
    );
    checkValues(
      startFromIndex + 2,
      generateDeleteDispatchMock({
        dispatchId: generateDispatchId(RegisterInternalKey.newRegisteredMemberNudge, memberId),
      }),
    );
    if (withLogReminder) {
      checkValues(
        startFromIndex + 3,
        generateDeleteDispatchMock({
          dispatchId: generateDispatchId(LogInternalKey.logReminder, memberId),
        }),
      );
      checkValues(
        startFromIndex + 4,
        generateDeleteDispatchMock({
          dispatchId: generateDispatchId(NotifyCustomKey.customContent, memberId),
        }),
      );
    }
  };

  const expectStringContaining = (nthCall: number, key: string, value: string | boolean) => {
    expect(handler.queueService.spyOnQueueServiceSendMessage).toHaveBeenNthCalledWith(
      nthCall,
      expect.objectContaining({
        type: QueueType.notifications,
        message: expect.stringContaining(
          key === 'externalUserId'
            ? key
            : typeof value === 'boolean'
            ? `"${key}":${value}`
            : `"${key}":"${value}"`,
        ),
      }),
    );
  };
});
