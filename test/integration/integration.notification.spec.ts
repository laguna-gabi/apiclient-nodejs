import {
  ContentKey,
  InnerQueueTypes,
  ObjectAppointmentScheduledClass,
  ObjectBaseClass,
  ObjectGeneralMemberTriggeredClass,
  ObjectNewMemberClass,
  ObjectNewMemberNudgeClass,
  ObjectUpdateMemberSettingsClass,
  Platform,
  generateAppointmentScheduleReminderMock,
  generateAppointmentScheduledMemberMock,
  generateAppointmentScheduledUserMock,
  generateBaseMock,
  generateDispatchId,
  generateGeneralMemberTriggeredMock,
  generateNewControlMemberMock,
  generateNewMemberMock,
  generateNewMemberNudgeMock,
  generateRequestAppointmentMock,
  generateUpdateMemberSettingsMock,
  generateUpdateUserSettingsMock,
} from '@lagunahealth/pandora';
import { hosts, scheduler } from 'config';
import { addDays, subDays, subMinutes } from 'date-fns';
import * as faker from 'faker';

import { v4 } from 'uuid';
import { Appointment } from '../../src/appointment';
import { QueueType, RegisterForNotificationParams, delay } from '../../src/common';
import { Member } from '../../src/member';
import { AppointmentsIntegrationActions, Creators, Handler } from '../aux';
import {
  generateCreateMemberParams,
  generateRequestAppointmentParams,
  generateScheduleAppointmentParams,
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
    it(`createMember: should updateClientSettings for user and member and send dispatch of type ${ContentKey.newMember} and ${ContentKey.newMemberNudge}`, async () => {
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
     *      2. delete dispatch ContentKey.newMemberNudge
     *      3. delete dispatch ContentKey.newRegisteredMember
     *      4. delete dispatch ContentKey.newRegisteredMemberNudge
     *      5. delete dispatch ContentKey.logReminder
     */
    test.each`
      title              | method
      ${'archiveMember'} | ${async ({ id }) => await handler.mutations.archiveMember({ id })}
      ${'deleteMember'}  | ${async ({ id }) => await handler.mutations.deleteMember({ id })}
    `(
      `$title: should delete settings and ${ContentKey.newMemberNudge} dispatch`,
      async (params) => {
        const org = await creators.createAndValidateOrg();
        const user = await creators.createAndValidateUser();
        const memberParams = generateCreateMemberParams({ userId: user.id, orgId: org.id });
        const { id } = await handler.mutations.createMember({ memberParams });
        await delay(200);
        handler.queueService.spyOnQueueServiceSendMessage.mockReset(); //not interested in past events

        await params.method({ id });
        await delay(200);

        expect(handler.queueService.spyOnQueueServiceSendMessage).toBeCalledTimes(5);
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
    it(`registerMemberForNotifications: should update member settings and send dispatch of type ${ContentKey.newRegisteredMember}, ${ContentKey.newRegisteredMemberNudge}, ${ContentKey.logReminder} and delete ${ContentKey.newMemberNudge}`, async () => {
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
        const mock1 = generateGeneralMemberTriggeredMock({
          recipientClientId: member.id,
          senderClientId: member.primaryUserId.toString(),
          contentKey,
          triggersAt: addDays(new Date(), amount),
        });
        const object1 = new ObjectGeneralMemberTriggeredClass(mock1);
        Object.keys(object1.objectGeneralMemberTriggeredMock).forEach((key) => {
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

      checkValues(ContentKey.newRegisteredMember, 1);
      checkValues(ContentKey.newRegisteredMemberNudge, 2);
      checkValues(ContentKey.logReminder, 3);

      expectStringContaining(5, 'type', InnerQueueTypes.deleteDispatch);
      expectStringContaining(
        5,
        'dispatchId',
        generateDispatchId(ContentKey.newMemberNudge, member.id),
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
        generateDispatchId(ContentKey.newMemberNudge, member.id),
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
    it(`createControlMember: should updateClientSettings for member and send dispatch of type ${ContentKey.newControlMember}`, async () => {
      handler.featureFlagService.spyOnFeatureFlagControlGroup.mockResolvedValueOnce(true);
      const org = await creators.createAndValidateOrg();
      const memberParams = generateCreateMemberParams({ orgId: org.id });
      const { id } = await handler.mutations.createMember({ memberParams });

      await delay(200);

      // send event to queue on update member config (on create control)
      const updateControlMemberSettingsMock = {
        type: InnerQueueTypes.updateClientSettings,
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
  });

  describe('Appointment', () => {
    /**
     * Trigger : AppointmentBase.scheduleAppointment
     * Dispatches:
     *      1. delete dispatch ContentKey.newMemberNudge
     *      2. delete dispatch ContentKey.newRegisteredMember
     *      3. delete dispatch ContentKey.newRegisteredMemberNudge
     *      4. send a text sms message to user that appointment has been scheduled for him/her
     *      5. send a text sms message to member that appointment has been scheduled for him/her
     *      6. set up a reminder for the member 15 minutes before the appointment
     *      7. set up a reminder for the member 1 day before the appointment
     */
    it(
      `scheduleAppointment: should send dispatches of types: ` +
        `${ContentKey.appointmentScheduledUser}, ${ContentKey.appointmentScheduledMember}, ` +
        `${ContentKey.appointmentReminder}, ${ContentKey.appointmentLongReminder} and ` +
        `delete types ${ContentKey.newMemberNudge}, ${ContentKey.newRegisteredMember}, ` +
        `${ContentKey.newRegisteredMemberNudge}`,
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
        const mockReminders = (contentKey: ContentKey, triggersAt: Date) => {
          return generateAppointmentScheduleReminderMock({
            recipientClientId: appointment.memberId.toString(),
            senderClientId: appointment.userId.toString(),
            ...baseParams,
            triggersAt,
            contentKey,
          });
        };

        checkValues(4, mockForUser);
        checkValues(5, mockForMember);
        checkValues(
          6,
          mockReminders(
            ContentKey.appointmentReminder,
            subMinutes(appointment.start, scheduler.alertBeforeInMin),
          ),
        );
        checkValues(
          7,
          mockReminders(ContentKey.appointmentLongReminder, subDays(appointment.start, 1)),
        );
      },
    );

    /**
     * Trigger : AppointmentBase.scheduleAppointment
     * Dispatches:
     *      1. delete dispatch ContentKey.newMemberNudge
     *      2. delete dispatch ContentKey.newRegisteredMember
     *      3. delete dispatch ContentKey.newRegisteredMemberNudge
     * Not sending create dispatches on past appointment
     */
    it(
      `scheduleAppointment: should only delete dispatches of types ` +
        `${ContentKey.newMemberNudge}, ${ContentKey.newRegisteredMember}, ` +
        `${ContentKey.newRegisteredMemberNudge} on past appointment`,
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
     *      1. delete dispatch ContentKey.appointmentReminder
     *      2. delete dispatch ContentKey.appointmentLongReminder
     */
    it(
      `endAppointment: should delete dispatches of types ` +
        `${ContentKey.appointmentReminder}, ${ContentKey.appointmentLongReminder}`,
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
            ContentKey.appointmentReminder,
            appointment.memberId.toString(),
            appointment.id,
          ),
        });
        checkValues(2, {
          type: InnerQueueTypes.deleteDispatch,
          dispatchId: generateDispatchId(
            ContentKey.appointmentLongReminder,
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
    it(`requestAppointment: should send dispatch of type ${ContentKey.appointmentRequest}`, async () => {
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

  describe('Webhooks', () => {
    /**
     * Trigger : WebhooksController.sendbird
     * Dispatches:
     *      1. ContentKey.newChatMessageFromUser or ContentKey.newChatMessageFromMember
     */

    /* eslint-disable max-len */
    test.each`
      contentKey                             | extractSender                                          | extractReceiver
      ${ContentKey.newChatMessageFromMember} | ${(member: Member) => member.id}                       | ${(member: Member) => member.primaryUserId.toString()}
      ${ContentKey.newChatMessageFromUser}   | ${(member: Member) => member.primaryUserId.toString()} | ${(member: Member) => member.id}
    `(
      `sendbird: should send dispatches of type ` +
        `$contentKey when received from sendbird webhook`,
      /* eslint-enable max-len */
      async (params) => {
        const org = await creators.createAndValidateOrg();
        const member = await creators.createAndValidateMember({ org, useNewUser: true });

        const communication = await handler.communicationService.get({
          memberId: member.id,
          userId: member.primaryUserId.toString(),
        });

        const payload = { ...sendbirdPayload };
        payload.sender.user_id = params.extractSender(member);
        payload.channel.channel_url = communication.sendBirdChannelUrl;
        payload.members = [{ user_id: member.primaryUserId.toString(), is_online: false }];

        const spyOnValidate = jest.spyOn(
          handler.webhooksController,
          'validateMessageSentFromSendbird',
        );
        spyOnValidate.mockReturnValueOnce(undefined);
        handler.queueService.spyOnQueueServiceSendMessage.mockReset(); //not interested in past events

        await handler.webhooksController.sendbird(JSON.stringify(payload), {});
        await delay(200);

        const mock = generateBaseMock({
          recipientClientId: params.extractReceiver(member),
          senderClientId: params.extractSender(member),
          contentKey: params.contentKey,
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
      dispatchId: generateDispatchId(ContentKey.newMemberNudge, memberId),
    });
    checkValues(startFromIndex + 1, {
      type: InnerQueueTypes.deleteDispatch,
      dispatchId: generateDispatchId(ContentKey.newRegisteredMember, memberId),
    });
    checkValues(startFromIndex + 2, {
      type: InnerQueueTypes.deleteDispatch,
      dispatchId: generateDispatchId(ContentKey.newRegisteredMemberNudge, memberId),
    });
    if (withLogReminder) {
      checkValues(startFromIndex + 3, {
        type: InnerQueueTypes.deleteDispatch,
        dispatchId: generateDispatchId(ContentKey.logReminder, memberId),
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
