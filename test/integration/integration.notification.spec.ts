import {
  CancelNotificationType,
  ClientCategory,
  ContentKey,
  CustomKey,
  ExternalKey,
  InnerQueueTypes,
  InternalKey,
  NotificationType,
  ObjectAppointmentScheduledClass,
  ObjectBaseClass,
  ObjectCallOrVideoClass,
  ObjectCancelClass,
  ObjectChatMessageUserClass,
  ObjectCustomContentClass,
  ObjectExternalContentClass,
  ObjectFutureNotifyClass,
  ObjectJournalContentClass,
  ObjectNewChatMessageToMemberClass,
  ObjectNewMemberClass,
  ObjectNewMemberNudgeClass,
  ObjectRegisterMemberWithTriggeredClass,
  ObjectUpdateMemberSettingsClass,
  Platform,
  QueueType,
  generateAppointmentScheduleLongReminderMock,
  generateAppointmentScheduleReminderMock,
  generateAppointmentScheduledMemberMock,
  generateAppointmentScheduledUserMock,
  generateChatMessageUserMock,
  generateDispatchId,
  generateExternalContentMock,
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
  generateUpdateMemberSettingsMock,
  generateUpdateUserSettingsMock,
} from '@lagunahealth/pandora';
import { general, hosts, scheduler } from 'config';
import { addDays, addSeconds, subDays, subMinutes } from 'date-fns';
import * as faker from 'faker';
import { internet } from 'faker';
import { v4 } from 'uuid';
import { Appointment } from '../../src/appointment';
import { RegisterForNotificationParams, delay, generatePath, reformatDate } from '../../src/common';
import { DailyReportCategoriesInput, DailyReportCategoryTypes } from '../../src/dailyReport';
import {
  AudioFormat,
  CancelNotifyParams,
  ImageFormat,
  NotifyParams,
  UpdateJournalTextParams,
} from '../../src/member';
import { AppointmentsIntegrationActions, Creators, Handler } from '../aux';
import {
  generateCreateMemberParams,
  generateDailyReport,
  generateNotifyContentParams,
  generateRequestAppointmentParams,
  generateScheduleAppointmentParams,
  generateUpdateJournalTextParams,
} from '../generators';
import * as sendbirdPayload from '../unit/mocks/webhookSendbirdNewMessagePayload.json';

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
    appointmentsActions = new AppointmentsIntegrationActions(handler.mutations);
    creators = new Creators(handler, appointmentsActions);
    await creators.createFirstUserInDbfNecessary();
  });

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
    it(`createMember: should updateClientSettings for user and member and send dispatch of type ${InternalKey.newMember} and ${InternalKey.newMemberNudge}`, async () => {
      const org = await creators.createAndValidateOrg();
      const user = await creators.createAndValidateUser();
      const memberParams = generateCreateMemberParams({ userId: user.id, orgId: org.id });
      const { id } = await handler.mutations.createMember({ memberParams });

      await delay(200);

      //send event to queue on update user config (create)
      const mockUser = generateUpdateUserSettingsMock({ id, ...user });
      const objectUser = new ObjectUpdateMemberSettingsClass(mockUser);
      Object.keys(objectUser.objectUpdateMemberSettings).forEach((key) => {
        expectStringContaining(1, key, mockUser[key]);
      });

      //send event to queue on update member config (create)
      const mockMember = generateUpdateMemberSettingsMock({
        id,
        ...memberParams,
        orgName: org.name,
      });
      const objectMember = new ObjectUpdateMemberSettingsClass(mockMember);
      Object.keys(objectMember.objectUpdateMemberSettings).forEach((key) => {
        if (key !== 'firstLoggedInAt') {
          expectStringContaining(2, key, mockMember[key]);
        }
      });

      const mock1 = generateNewMemberMock({ recipientClientId: id, senderClientId: user.id });
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

      const mock2 = generateNewMemberNudgeMock({ recipientClientId: id, senderClientId: user.id });
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
     * Trigger : MemberResolver.archiveMember / MemberResolver.deleteMember
     * Settings :
     *      1. delete member client settings
     * Dispatches :
     *      2. delete dispatch InternalKey.newMemberNudge
     *      3. delete dispatch InternalKey.newRegisteredMember
     *      4. delete dispatch InternalKey.newRegisteredMemberNudge
     *      5. delete dispatch InternalKey.logReminder
     *      6. delete dispatch InternalKey.customContent
     */
    test.each`
      title              | method
      ${'archiveMember'} | ${async ({ id }) => await handler.mutations.archiveMember({ id })}
      ${'deleteMember'}  | ${async ({ id }) => await handler.mutations.deleteMember({ id })}
    `(
      `$title: should delete settings and ${InternalKey.newMemberNudge} dispatch`,
      async (params) => {
        const org = await creators.createAndValidateOrg();
        const user = await creators.createAndValidateUser();
        const memberParams = generateCreateMemberParams({ userId: user.id, orgId: org.id });
        const { id } = await handler.mutations.createMember({ memberParams });
        await delay(200);
        handler.queueService.spyOnQueueServiceSendMessage.mockReset(); //not interested in past events

        await params.method({ id });
        await delay(200);

        expect(handler.queueService.spyOnQueueServiceSendMessage).toBeCalledTimes(6);
        checkValues(1, { type: InnerQueueTypes.deleteClientSettings, id });
        checkDeleteDispatches(id, true, 2);
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
    // eslint-disable-next-line max-len
    it(`registerMemberForNotifications: should update member settings and send dispatch of type ${InternalKey.newRegisteredMember}, ${InternalKey.newRegisteredMemberNudge}, ${InternalKey.logReminder} and delete ${InternalKey.newMemberNudge}`, async () => {
      const org = await creators.createAndValidateOrg();
      const member = await creators.createAndValidateMember({ org, useNewUser: true });

      await delay(200);
      handler.queueService.spyOnQueueServiceSendMessage.mockReset(); //not interested in past events

      const params: RegisterForNotificationParams = {
        platform: Platform.android,
        isPushNotificationsEnabled: true,
      };
      await handler
        .setContextUserId(member.id)
        .mutations.registerMemberForNotifications({ registerForNotificationParams: params });

      await delay(200);

      const { firstLoggedInAt } = await handler
        .setContextUserId(member.id)
        .queries.getMemberConfig({ id: member.id });

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
                key === 'correlationId' || key === 'triggersAt' ? key : `"${key}":"${mock1[key]}"`,
              ),
            }),
          );
        });
      };

      checkValues(InternalKey.newRegisteredMember, 1);
      checkValues(InternalKey.newRegisteredMemberNudge, 2);
      checkValues(InternalKey.logReminder, 3);

      expectStringContaining(5, 'type', InnerQueueTypes.deleteDispatch);
      expectStringContaining(
        5,
        'dispatchId',
        generateDispatchId(InternalKey.newMemberNudge, member.id),
      );
    });

    /**
     * Trigger : MemberResolver.registerMemberForNotifications
     * Settings :
     *      1. update member settings : send event to queue on update member config (create)
     */
    // eslint-disable-next-line max-len
    it('registerMemberForNotifications: should not re-send dispatches if member already logged in', async () => {
      const org = await creators.createAndValidateOrg();
      const member = await creators.createAndValidateMember({ org, useNewUser: true });

      await delay(200);

      const params: RegisterForNotificationParams = {
        platform: Platform.android,
        isPushNotificationsEnabled: true,
      };
      await handler
        .setContextUserId(member.id)
        .mutations.registerMemberForNotifications({ registerForNotificationParams: params });

      await delay(200);
      handler.queueService.spyOnQueueServiceSendMessage.mockReset(); //not interested in past events

      //calling registerMemberForNotifications again
      const newParams: RegisterForNotificationParams = {
        platform: Platform.ios,
        isPushNotificationsEnabled: false,
      };
      await handler.setContextUserId(member.id).mutations.registerMemberForNotifications({
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
        generateDispatchId(InternalKey.newMemberNudge, member.id),
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
    it(`createControlMember: should updateClientSettings for member and send dispatch of type ${InternalKey.newControlMember}`, async () => {
      handler.featureFlagService.spyOnFeatureFlagControlGroup.mockResolvedValueOnce(true);
      const org = await creators.createAndValidateOrg();
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
        honorific: memberParams.honorific,
        zipCode: memberParams.zipCode,
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
      const org = await creators.createAndValidateOrg();
      const member = await creators.createAndValidateMember({ org, useNewUser: true });

      await delay(200);
      handler.queueService.spyOnQueueServiceSendMessage.mockReset(); //not interested in past events

      const when = addSeconds(new Date(), 1);
      const notifyParams: NotifyParams = {
        memberId: member.id,
        userId: member.primaryUserId.toString(),
        type: NotificationType.text,
        metadata: { content: faker.lorem.word(), when },
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
      const org = await creators.createAndValidateOrg();
      const member = await creators.createAndValidateMember({ org, useNewUser: true });

      await delay(200);
      handler.queueService.spyOnQueueServiceSendMessage.mockReset(); //not interested in past events

      const notifyParams: NotifyParams = {
        memberId: member.id,
        userId: member.primaryUserId.toString(),
        type: NotificationType.textSms,
        metadata: { content: faker.lorem.word() },
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
        const org = await creators.createAndValidateOrg();
        const member = await creators.createAndValidateMember({ org, useNewUser: true });

        const params: RegisterForNotificationParams = {
          platform: Platform.android,
          isPushNotificationsEnabled: true,
        };
        await handler
          .setContextUserId(member.id)
          .mutations.registerMemberForNotifications({ registerForNotificationParams: params });

        await delay(500);
        handler.queueService.spyOnQueueServiceSendMessage.mockReset(); //not interested in past events

        const notifyParams: NotifyParams = {
          memberId: member.id,
          userId: member.primaryUserId.toString(),
          type,
          metadata: { peerId: faker.datatype.uuid() },
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
     *      1. send ExternalKey dispatch
     */
    test.each(Object.values(ExternalKey))(
      `notifyContent: dispatch message of type %p`,
      async (contentKey) => {
        const org = await creators.createAndValidateOrg();
        const member = await creators.createAndValidateMember({ org, useNewUser: true });

        const params: RegisterForNotificationParams = {
          platform: Platform.android,
          isPushNotificationsEnabled: true,
        };
        await handler
          .setContextUserId(member.id)
          .mutations.registerMemberForNotifications({ registerForNotificationParams: params });

        await delay(500);
        handler.queueService.spyOnQueueServiceSendMessage.mockReset(); //not interested in past events

        const notifyContentParams = generateNotifyContentParams({
          memberId: member.id,
          userId: member.primaryUserId.toString(),
          contentKey,
        });

        await handler.mutations.notifyContent({ notifyContentParams });
        await delay(200);

        const mock = generateExternalContentMock({
          recipientClientId: notifyContentParams.memberId,
          senderClientId: notifyContentParams.userId,
          path: generatePath(NotificationType.text, contentKey),
          contentKey,
        });
        const object = new ObjectExternalContentClass(mock);
        Object.keys(object.objectExternalContentType).forEach((key) => {
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
     * Trigger : MemberResolver.cancelNotify
     * Dispatch :
     *      1. send cancelVideo/cancelCall/cancelText dispatch
     */
    test.each([
      CancelNotificationType.cancelCall,
      CancelNotificationType.cancelText,
      CancelNotificationType.cancelVideo,
    ])(`notify: dispatch message of type %p`, async (type) => {
      const org = await creators.createAndValidateOrg();
      const member = await creators.createAndValidateMember({ org, useNewUser: true });

      const params: RegisterForNotificationParams = {
        platform: Platform.android,
        isPushNotificationsEnabled: true,
      };
      await handler
        .setContextUserId(member.id)
        .mutations.registerMemberForNotifications({ registerForNotificationParams: params });

      await delay(500);
      handler.queueService.spyOnQueueServiceSendMessage.mockReset(); //not interested in past events

      const cancelNotifyParams: CancelNotifyParams = {
        memberId: member.id,
        type,
        metadata: { peerId: faker.datatype.uuid() },
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
        `${InternalKey.appointmentScheduledUser}, ${InternalKey.appointmentScheduledMember}, ` +
        `${InternalKey.appointmentReminder}, ${InternalKey.appointmentLongReminder} and ` +
        `delete types ${InternalKey.newMemberNudge}, ${InternalKey.newRegisteredMember}, ` +
        `${InternalKey.newRegisteredMemberNudge}`,
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
            triggersAt: subMinutes(appointment.start, scheduler.alertBeforeInMin),
            chatLink: communication.chat.memberLink,
          }),
        );
        checkValues(
          7,
          generateAppointmentScheduleLongReminderMock({
            recipientClientId: appointment.memberId.toString(),
            senderClientId: appointment.userId.toString(),
            ...baseParams,
            triggersAt: subDays(appointment.start, 1),
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
        `${InternalKey.newMemberNudge}, ${InternalKey.newRegisteredMember}, ` +
        `${InternalKey.newRegisteredMemberNudge} on past appointment`,
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
        `${InternalKey.appointmentReminder}, ${InternalKey.appointmentLongReminder}`,
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
            InternalKey.appointmentReminder,
            appointment.memberId.toString(),
            appointment.id,
          ),
        });
        checkValues(2, {
          type: InnerQueueTypes.deleteDispatch,
          dispatchId: generateDispatchId(
            InternalKey.appointmentLongReminder,
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
        `${InternalKey.appointmentReminder}, ${InternalKey.appointmentLongReminder}`,
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
            InternalKey.appointmentReminder,
            appointment.memberId.toString(),
            appointment.id,
          ),
        });
        checkValues(2, {
          type: InnerQueueTypes.deleteDispatch,
          dispatchId: generateDispatchId(
            InternalKey.appointmentLongReminder,
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
    it(`requestAppointment: should send dispatch of type ${InternalKey.appointmentRequest}`, async () => {
      const org = await creators.createAndValidateOrg();
      const user = await creators.createAndValidateUser();
      const member = await creators.createAndValidateMember({ org });
      const fakeUUID = faker.datatype.uuid();
      const appointmentParams = generateRequestAppointmentParams({
        userId: user.id,
        memberId: member.id,
      });
      (v4 as jest.Mock).mockImplementationOnce(() => fakeUUID);
      const { id: appointmentId } = await handler.mutations.requestAppointment({
        appointmentParams,
      });

      await delay(200);

      const mock = generateRequestAppointmentMock({
        recipientClientId: member.id,
        senderClientId: user.id,
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
    `publishJournal: should create dispatches of types ${CustomKey.journalContent} $description`,
    async (params) => {
      const org = await creators.createAndValidateOrg();
      const member = await creators.createAndValidateMember({ org, useNewUser: true });

      await delay(200);

      const { id: journalId } = await handler.setContextUserId(member.id).mutations.createJournal();
      const updateJournalTextParams: UpdateJournalTextParams = generateUpdateJournalTextParams({
        id: journalId,
      });
      const journal = await handler.setContextUserId(member.id).mutations.updateJournalText({
        updateJournalTextParams,
      });

      const { journalAudioDownloadLink, journalImageDownloadLink } = await generateLinksMocks({
        params,
        journalId,
        memberId: member.id,
      });

      handler.queueService.spyOnQueueServiceSendMessage.mockReset(); //not interested in past events

      await handler.setContextUserId(member.id).mutations.publishJournal({ id: journalId });

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
    memberId,
  }): Promise<{ journalAudioDownloadLink; journalImageDownloadLink }> => {
    let journalImageDownloadLink, journalAudioDownloadLink;

    if (params.imageLink) {
      const link = internet.url();
      handler.storage.spyOnStorageUpload.mockReturnValueOnce(link);
      handler.storage.spyOnStorageDownload.mockReturnValueOnce(link);

      const { normalImageLink } = await handler
        .setContextUserId(memberId)
        .queries.getMemberUploadJournalImageLink({
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

      const { audioLink } = await handler
        .setContextUserId(memberId)
        .queries.getMemberUploadJournalAudioLink({
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
    it(`sendbird: should send dispatches of type ${InternalKey.newChatMessageFromMember} when received from sendbird webhook`, async () => {
      /* eslint-enable max-len */
      const org = await creators.createAndValidateOrg();
      const member = await creators.createAndValidateMember({ org, useNewUser: true });

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
        contentKey: InternalKey.newChatMessageFromMember,
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
    it(`sendbird: should send dispatches of type ${InternalKey.newChatMessageFromUser} when received from sendbird webhook`, async () => {
      /* eslint-enable max-len */
      const org = await creators.createAndValidateOrg();
      const member = await creators.createAndValidateMember({ org, useNewUser: true });

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
    it(`twilio: should send dispatches of type ${CustomKey.customContent} and content from the sms message`, async () => {
      const org = await creators.createAndValidateOrg();
      const member = await creators.createAndValidateMember({ org, useNewUser: true });

      await delay(200);
      handler.queueService.spyOnQueueServiceSendMessage.mockReset(); //not interested in past events

      const payload = { Body: faker.lorem.word(), From: member.phone, Token: 'token' };
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
    it(`setDailyReportCategories: should send dispatch ${InternalKey.memberNotFeelingWellMessage}`, async () => {
      /* eslint-enable max-len */
      const org = await creators.createAndValidateOrg();
      const member = await creators.createAndValidateMember({ org, useNewUser: true });

      await delay(200);
      handler.queueService.spyOnQueueServiceSendMessage.mockReset(); //not interested in past events

      jest
        .spyOn(handler.dailyReportService, 'setDailyReportCategories')
        .mockImplementation(async () =>
          generateDailyReport({ statsOverThreshold: [DailyReportCategoryTypes.Pain] }),
        );

      await handler
        .setContextUserId(member.id, member.primaryUserId.toString())
        .mutations.setDailyReportCategories({
          dailyReportCategoriesInput: {
            date: reformatDate(faker.date.recent().toString(), general.get('dateFormatString')),
            categories: [{ category: DailyReportCategoryTypes.Pain, rank: 1 }],
          } as DailyReportCategoriesInput,
        });
      await delay(200);

      const mock = generateTextMessageUserMock({
        senderClientId: member.id,
        recipientClientId: member.primaryUserId.toString(),
        contentKey: InternalKey.memberNotFeelingWellMessage,
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
    const org = await creators.createAndValidateOrg();
    const member = await creators.createAndValidateMember({ org, useNewUser: true });

    await delay(200);
    handler.queueService.spyOnQueueServiceSendMessage.mockReset(); //not interested in past events

    const appointmentParams = generateScheduleAppointmentParams({
      userId: member.primaryUserId.toString(),
      memberId: member.id,
      start,
    });
    return handler.mutations.scheduleAppointment({ appointmentParams });
  };

  const checkValues = (amount: number, mock) => {
    const object = new ObjectAppointmentScheduledClass(mock);
    Object.keys(object.objectAppointmentScheduledType).forEach((key) => {
      expect(handler.queueService.spyOnQueueServiceSendMessage).toHaveBeenNthCalledWith(
        amount,
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
    checkValues(startFromIndex, {
      type: InnerQueueTypes.deleteDispatch,
      dispatchId: generateDispatchId(InternalKey.newMemberNudge, memberId),
    });
    checkValues(startFromIndex + 1, {
      type: InnerQueueTypes.deleteDispatch,
      dispatchId: generateDispatchId(InternalKey.newRegisteredMember, memberId),
    });
    checkValues(startFromIndex + 2, {
      type: InnerQueueTypes.deleteDispatch,
      dispatchId: generateDispatchId(InternalKey.newRegisteredMemberNudge, memberId),
    });
    if (withLogReminder) {
      checkValues(startFromIndex + 3, {
        type: InnerQueueTypes.deleteDispatch,
        dispatchId: generateDispatchId(InternalKey.logReminder, memberId),
      });
      checkValues(startFromIndex + 4, {
        type: InnerQueueTypes.deleteDispatch,
        dispatchId: generateDispatchId(CustomKey.customContent, memberId),
      });
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
