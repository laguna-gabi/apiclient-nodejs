import axios from 'axios';
import * as faker from 'faker';
import { v4 } from 'uuid';
import { AppointmentStatus } from '../../src/appointment';
import { Logger, NotificationType, SendSendBirdNotification } from '../../src/common';
import { CreateSendbirdGroupChannelParams } from '../../src/communication';
import { ConfigsService, SendBird } from '../../src/providers';
import { UserRole } from '../../src/user';
import { generateId } from '../generators';
import { EventEmitter2 } from '@nestjs/event-emitter';

describe('live: sendbird actions', () => {
  let sendBird: SendBird;

  beforeAll(async () => {
    const configService = new ConfigsService();
    const logger = new Logger(new EventEmitter2());
    sendBird = new SendBird(configService, logger);
    await sendBird.onModuleInit();
  });

  /**
   * Flow:
   * 1. Create a user (coach)
   * 2. Create a member
   * 3. Create a group channel between user(coach) and user(member)
   * 4. Freeze group channel
   * 5. Send message (should work even though the channel is frozen)
   * 6. Get member's unread messages
   * 7. Un-freeze group channel
   * 8. Update metadata for appointment1
   * 9. Update metadata for appointment2 (check that we have 2 appointments in the metadata now)
   * 10. Delete metadata for appointment2
   * 11. Create another user (coach)
   * 12. replace coach in channel (leave & invite)
   * 13. replace channel name and image
   */
  // 1. Create a user (coach)
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

    // 2. Create a member
    const member = {
      user_id: generateId(),
      nickname: faker.name.firstName(),
      profile_url: '',
      issue_access_token: true,
      metadata: {},
    };
    const memberResult = await sendBird.createUser(member);
    expect(memberResult).toEqual(expect.any(String));

    // 3. Create a group channel between user(coach) and user(member)
    const params: CreateSendbirdGroupChannelParams = {
      name: user.nickname,
      channel_url: v4(),
      cover_url: user.profile_url,
      inviter_id: user.user_id,
      user_ids: [member.user_id, user.user_id],
    };
    const groupChannelResult = await sendBird.createGroupChannel(params);
    expect(groupChannelResult).toBeTruthy();

    // 4. Freeze group channel
    await sendBird.freezeGroupChannel(params.channel_url, true);

    // 5. Send message (should work even though the channel is frozen)
    const sendSendBirdNotification: SendSendBirdNotification = {
      userId: user.user_id,
      sendBirdChannelUrl: params.channel_url,
      message: 'test',
      notificationType: NotificationType.textSms,
    };
    const messageId = await sendBird.send(sendSendBirdNotification);
    expect(messageId).toEqual(expect.any(Number));

    // 6. Get member's unread messages
    const unreadMessagesCount = await sendBird.countUnreadMessages(
      params.channel_url,
      member.user_id,
    );
    expect(unreadMessagesCount).toEqual(1);

    // 7. Un-freeze group channel
    await sendBird.freezeGroupChannel(params.channel_url, false);

    // 8. Update metadata for appointment1
    const appointmentId1 = generateId();
    const value1 = { status: AppointmentStatus.scheduled, start: faker.date.future() };
    await sendBird.updateGroupChannelMetadata(params.channel_url, appointmentId1, value1);
    await validateGroupChannel(params.channel_url, [appointmentId1], [value1]);

    // 9. Update metadata for appointment2 (check that we have 2 appointments in the metadata now)
    const appointmentId2 = generateId();
    const value2 = { status: AppointmentStatus.scheduled, start: faker.date.future() };
    await sendBird.updateGroupChannelMetadata(params.channel_url, appointmentId2, value2);
    await validateGroupChannel(
      params.channel_url,
      [appointmentId1, appointmentId2],
      [value1, value2],
    );

    // 10. Delete metadata for appointment2
    await sendBird.deleteGroupChannelMetadata(params.channel_url, appointmentId2);
    await validateGroupChannel(params.channel_url, [appointmentId1], [value1]);

    // 11. Create another user (coach)
    const newUser = {
      user_id: v4(),
      nickname: faker.name.firstName(),
      profile_url: faker.image.avatar(),
      issue_access_token: true,
      metadata: { role: UserRole.coach.toLowerCase() },
    };
    await sendBird.createUser(newUser);

    // 12. replace coach in channel (leave & invite)
    const leaveResult = await sendBird.leave(params.channel_url, user.user_id);
    expect(leaveResult.data).toEqual({});

    const inviteResult = await sendBird.invite(params.channel_url, newUser.user_id);
    expect(inviteResult.data.members[0].user_id).toEqual(newUser.user_id);
    expect(inviteResult.data.members[1].user_id).toEqual(member.user_id);

    // 13. replace channel name and image
    const replaceResult = await sendBird.updateChannelName(
      params.channel_url,
      newUser.nickname,
      newUser.profile_url,
    );
    expect(JSON.parse(replaceResult.config.data).name).toEqual(newUser.nickname);
    expect(JSON.parse(replaceResult.config.data).cover_url).toEqual(newUser.profile_url);
  }, 30000);

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
