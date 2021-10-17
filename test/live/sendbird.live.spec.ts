import { SendBird } from '../../src/providers';
import { v4 } from 'uuid';
import * as faker from 'faker';
import { CreateSendbirdGroupChannelParams } from '../../src/communication';
import { UserRole } from '../../src/user';
import { generateId } from '../generators';
import { AppointmentStatus } from '../../src/appointment';
import axios from 'axios';
import { Test, TestingModule } from '@nestjs/testing';
import { dbDisconnect, defaultModules } from '../common';
import { SendSendbirdNotification, NotificationType } from '../../src/common';

describe('live: sendbird actions', () => {
  let module: TestingModule;
  let sendBird: SendBird;

  beforeAll(async () => {
    module = await Test.createTestingModule({ imports: defaultModules() }).compile();
    sendBird = module.get<SendBird>(SendBird);
    await sendBird.onModuleInit();
  });

  afterAll(async () => {
    await module.close();
    await dbDisconnect();
  });

  /**
   * Flow:
   * 1. create a user (coach)
   * 2. create a user (member)
   * 3. create a group channel between user(coach) and user(member)
   * 4. freeze group channel
   * 5. send message (should work even though the channel is frozen)
   * 5. un-freeze group channel
   * 6. update metadata for appointment1
   * 7. update metadata for appointment2 (check that we have 2 appointments in the metadata now)
   * 8. delete metadata for appointment2
   */
  it('should do sendbird flow', async () => {
    const user = {
      user_id: v4(),
      nickname: faker.name.firstName(),
      profile_url: faker.image.avatar(),
      issue_access_token: true,
      metadata: { role: UserRole.coach.toLowerCase() },
    };
    const userResult = await sendBird.createUser(user);
    expect(userResult).toEqual(expect.any(String));

    const member = {
      user_id: generateId(),
      nickname: faker.name.firstName(),
      profile_url: '',
      issue_access_token: true,
      metadata: {},
    };
    const memberResult = await sendBird.createUser(member);
    expect(memberResult).toEqual(expect.any(String));

    const params: CreateSendbirdGroupChannelParams = {
      name: user.nickname,
      channel_url: v4(),
      cover_url: user.profile_url,
      inviter_id: user.user_id,
      user_ids: [member.user_id, user.user_id],
    };
    const groupChannelResult = await sendBird.createGroupChannel(params);
    expect(groupChannelResult).toBeTruthy();

    await sendBird.freezeGroupChannel(params.channel_url, true);

    const sendSendbirdNotification: SendSendbirdNotification = {
      userId: user.user_id,
      sendbirdChannelUrl: params.channel_url,
      message: 'test',
      notificationType: NotificationType.textSms,
    };
    const messageId = await sendBird.send(sendSendbirdNotification);
    expect(messageId).toEqual(expect.any(Number));

    await sendBird.freezeGroupChannel(params.channel_url, false);

    const appointmentId1 = generateId();
    const value1 = { status: AppointmentStatus.scheduled, start: faker.date.future() };
    await sendBird.updateGroupChannelMetadata(params.channel_url, appointmentId1, value1);
    await validateGroupChannel(params.channel_url, [appointmentId1], [value1]);

    const appointmentId2 = generateId();
    const value2 = { status: AppointmentStatus.scheduled, start: faker.date.future() };
    await sendBird.updateGroupChannelMetadata(params.channel_url, appointmentId2, value2);
    await validateGroupChannel(
      params.channel_url,
      [appointmentId1, appointmentId2],
      [value1, value2],
    );

    await sendBird.deleteGroupChannelMetadata(params.channel_url, appointmentId2);
    await validateGroupChannel(params.channel_url, [appointmentId1], [value1]);
  }, 20000);

  const validateGroupChannel = async (
    channelUrl: string,
    appointmentIds: string[],
    compareTo: any[],
  ) => {
    const url = `${sendBird.basePath}group_channels/${channelUrl}`;
    const current = await axios.get(url, { headers: sendBird.headers });
    const { appointments } = JSON.parse(current.data.data);

    expect(Object.keys(appointments).length).toEqual(appointmentIds.length);
    for (let i = 0; i < appointmentIds.length; i++) {
      expect(appointments[appointmentIds[i]].status).toEqual(compareTo[i].status);
      expect(new Date(appointments[appointmentIds[i]].start)).toEqual(compareTo[i].start);
    }
  };
});
