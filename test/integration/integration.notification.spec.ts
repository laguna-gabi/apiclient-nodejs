import { AppointmentsIntegrationActions, Creators, Handler } from '../aux';
import { generateCreateMemberParams } from '../generators';
import {
  ContentKey,
  InnerQueueTypes,
  ObjectGeneralMemberTriggeredClass,
  ObjectNewMemberClass,
  ObjectNewMemberNudgeClass,
  ObjectUpdateMemberSettingsClass,
  Platform,
  generateDispatchId,
  generateGeneralMemberTriggeredMock,
  generateNewMemberMock,
  generateNewMemberNudgeMock,
  generateUpdateMemberSettingsMock,
  generateUpdateUserSettingsMock,
} from '@lagunahealth/pandora';
import { addDays } from 'date-fns';
import { QueueType, RegisterForNotificationParams, delay } from '../../src/common';

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

  /**
   * Trigger : MemberResolver.createMember
   * Settings :
   *      1. update member settings : send event to queue on update member config (create)
   *      2. update user settings : send event to queue on update user config (create)
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

    //send event to queue on update member config (create)
    const mockUser = generateUpdateUserSettingsMock({ id, ...user });
    const objectUser = new ObjectUpdateMemberSettingsClass(mockUser);
    Object.keys(objectUser.objectUpdateMemberSettings).forEach((key) => {
      expectStringContaining(1, key, mockUser[key]);
    });

    //send event to queue on update user config (create)
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
   */
  test.each`
    title              | method
    ${'archiveMember'} | ${async ({ id }) => await handler.mutations.archiveMember({ id })}
    ${'deleteMember'}  | ${async ({ id }) => await handler.mutations.deleteMember({ id })}
  `(`$title: should delete settings and ${ContentKey.newMemberNudge} dispatch`, async (params) => {
    const org = await creators.createAndValidateOrg();
    const user = await creators.createAndValidateUser();
    const memberParams = generateCreateMemberParams({ userId: user.id, orgId: org.id });
    const { id } = await handler.mutations.createMember({ memberParams });
    await delay(200);
    handler.queueService.spyOnQueueServiceSendMessage.mockReset(); //not interested in past events

    await params.method({ id });
    await delay(200);

    expectStringContaining(1, 'type', InnerQueueTypes.deleteClientSettings);
    expectStringContaining(1, 'id', id);
    expectStringContaining(2, 'type', InnerQueueTypes.deleteDispatch);
    expectStringContaining(2, 'dispatchId', generateDispatchId(ContentKey.newMemberNudge, id));
  });

  /**
   * Trigger : MemberResolver.registerMemberForNotifications
   * Settings :
   *      1. update member settings : send event to queue on update member config (create)
   * Dispatches :
   *      2. send newRegisteredMember dispatch (triggered in 1 day)
   *      3. send newRegisteredMemberNudge dispatch (triggered in 2 days)
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
