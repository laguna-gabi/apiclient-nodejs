import {AppointmentsIntegrationActions, Creators, Handler} from '../aux';
import {generateCreateMemberParams} from '../generators';
import {
  ContentKey,
  InnerQueueTypes,
  ObjectNewMemberClass,
  ObjectNewMemberNudgeClass,
  ObjectUpdateMemberSettingsClass,
  Platform,
  generateDispatchId,
  generateNewMemberMock,
  generateNewMemberNudgeMock,
  generateUpdateMemberSettingsMock,
  generateUpdateUserSettingsMock,
} from '@lagunahealth/pandora';
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

  describe(`${InnerQueueTypes.updateClientSettings}`, () => {
    afterEach(() => {
      handler.queueService.spyOnQueueServiceSendMessage.mockReset();
    });

    it(`should notify on a new user and member and their client settings objects`, async () => {
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
    });

    it(`should update fields on registerMemberForNotifications`, async () => {
      const org = await creators.createAndValidateOrg();
      const user = await creators.createAndValidateUser();
      const memberParams = generateCreateMemberParams({ userId: user.id, orgId: org.id });
      const { id } = await handler.mutations.createMember({ memberParams });

      await delay(200);
      handler.queueService.spyOnQueueServiceSendMessage.mockReset(); //not interested in past events

      const params: RegisterForNotificationParams = {
        memberId: id,
        platform: Platform.android,
        isPushNotificationsEnabled: true,
      };
      await handler.setContextUserId(id).mutations.registerMemberForNotifications({
        registerForNotificationParams: params,
      });

      await delay(200);

      const { firstLoggedInAt } = await handler
        .setContextUserId(id)
        .queries.getMemberConfig({ id });

      expectStringContaining(1, 'platform', params.platform);
      expectStringContaining(1, 'isPushNotificationsEnabled', params.isPushNotificationsEnabled);
      expectStringContaining(1, 'firstLoggedInAt', firstLoggedInAt);
    });
  });

  describe(`${InnerQueueTypes.deleteClientSettings}`, () => {
    afterEach(() => {
      handler.queueService.spyOnQueueServiceSendMessage.mockReset();
    });

    test.each`
      title              | method
      ${'archiveMember'} | ${async ({ id }) => await handler.mutations.archiveMember({ id })}
      ${'deleteMember'}  | ${async ({ id }) => await handler.mutations.deleteMember({ id })}
    `(`should notify delete settings on $title`, async (params) => {
      const org = await creators.createAndValidateOrg();
      const user = await creators.createAndValidateUser();
      const memberParams = generateCreateMemberParams({ userId: user.id, orgId: org.id });
      const { id } = await handler.mutations.createMember({ memberParams });
      await delay(200);
      handler.queueService.spyOnQueueServiceSendMessage.mockReset(); //not interested in past events

      await params.method({ id });
      await delay(200);

      expectStringContaining(1, 'id', id);
    });

    it(`should notify delete settings on deleteMember`, async () => {
      const org = await creators.createAndValidateOrg();
      const user = await creators.createAndValidateUser();
      const memberParams = generateCreateMemberParams({ userId: user.id, orgId: org.id });
      const { id } = await handler.mutations.createMember({ memberParams });
      await delay(200);
      handler.queueService.spyOnQueueServiceSendMessage.mockReset(); //not interested in past events

      await handler.mutations.archiveMember({ id });
      await delay(200);

      expectStringContaining(1, 'id', id);
    });
  });

  describe(`${InnerQueueTypes.createDispatch}`, () => {
    // eslint-disable-next-line max-len
    it(`createMember: should send dispatch of type ${ContentKey.newMember} and ${ContentKey.newMemberNudge}`, async () => {
      const org = await creators.createAndValidateOrg();
      const user = await creators.createAndValidateUser();

      const memberParams = generateCreateMemberParams({ userId: user.id, orgId: org.id });
      const { id: recipientClientId } = await handler.mutations.createMember({ memberParams });

      await delay(200);

      const mock1 = generateNewMemberMock({ recipientClientId, senderClientId: user.id });
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

      const mock2 = generateNewMemberNudgeMock({ recipientClientId, senderClientId: user.id });
      const object2 = new ObjectNewMemberNudgeClass(mock2);
      Object.keys(object2.objectNewMemberNudgeMock).forEach((key) => {
        expect(handler.queueService.spyOnQueueServiceSendMessage).toHaveBeenNthCalledWith(
          4,
          expect.objectContaining({
            type: QueueType.notifications,
            message: expect.stringContaining(
              key === 'correlationId' || key === 'appointmentId' || key === 'triggeredAt'
                ? key
                : `"${key}":"${mock2[key]}"`,
            ),
          }),
        );
      });
    });
  });

  describe(`${InnerQueueTypes.deleteDispatch}`, () => {
    test.each`
      title              | method
      ${'archiveMember'} | ${async ({ id }) => await handler.mutations.archiveMember({ id })}
      ${'deleteMember'}  | ${async ({ id }) => await handler.mutations.deleteMember({ id })}
    `(`$title: should should delete ${ContentKey.newMemberNudge} dispatch`, async (params) => {
      const org = await creators.createAndValidateOrg();
      const { id } = await creators.createAndValidateMember({ org });
      await delay(500);
      handler.queueService.spyOnQueueServiceSendMessage.mockReset(); //not interested in past events

      await params.method({ id });
      await delay(200);

      expectStringContaining(2, 'dispatchId', generateDispatchId(ContentKey.newMemberNudge, id));
    });
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
