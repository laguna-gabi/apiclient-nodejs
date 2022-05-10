import { mockLogger } from '@argus/pandora';
import { HttpService } from '@nestjs/axios';
import { EventEmitter2 } from '@nestjs/event-emitter';
import axios from 'axios';
import { date, image, name } from 'faker';
import { PARAMS_PROVIDER_TOKEN, Params } from 'nestjs-pino';
import { v4 } from 'uuid';
import { LoggerService, UserRole } from '../../src/common';
import { CreateSendbirdGroupChannelParams } from '../../src/communication';
import { ConfigsService, SendBird } from '../../src/providers';
import { generateId } from '../generators';
import { AppointmentStatus } from '@argus/hepiusClient';

describe('live: sendbird actions', () => {
  let sendBird: SendBird;

  beforeAll(async () => {
    const configService = new ConfigsService();
    const logger = new LoggerService(PARAMS_PROVIDER_TOKEN as Params, new EventEmitter2());
    mockLogger(logger);
    const httpService = new HttpService();
    sendBird = new SendBird(configService, httpService, logger);
    await sendBird.onModuleInit();
  });

  /**
   * Flow:
   * 1. Create a user (coach)
   * 2. Create a member
   * 3. Create a group channel between user(coach) and user(member)
   * 4. Freeze group channel
   * 5. Get member's unread messages
   * 6. Un-freeze group channel
   * 7. Update metadata for appointment1
   * 8. Update metadata for appointment2 (check that we have 2 appointments in the metadata now)
   * 9. Delete metadata for appointment2
   * 10. Create another user (coach)
   * 11. replace coach in channel (leave & invite)
   * 12. replace channel name and image
   * 13. update a user
   */
  it('should do sendbird flow', async () => {
    // 1. Create a user (coach)
    const user = {
      user_id: v4(),
      nickname: name.firstName(),
      profile_url: image.avatar(),
      issue_access_token: true,
      metadata: { role: UserRole.coach.toLowerCase() },
    };
    const userResult = await sendBird.createUser(user);
    expect(userResult).toEqual(expect.any(String));

    // 2. Create a member
    const member = {
      user_id: generateId(),
      nickname: name.firstName(),
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

    // 5. Get member's unread messages
    const unreadMessagesCount = await sendBird.countUnreadMessages(
      params.channel_url,
      member.user_id,
    );
    expect(unreadMessagesCount).toEqual(0);

    // 6. Un-freeze group channel
    await sendBird.freezeGroupChannel(params.channel_url, false);

    // 7. Update metadata for appointment1
    const appointmentId1 = generateId();
    const value1 = { status: AppointmentStatus.scheduled, start: date.future() };
    await sendBird.updateGroupChannelMetadata(params.channel_url, appointmentId1, value1);
    await validateGroupChannel(params.channel_url, [appointmentId1], [value1]);

    // 8. Update metadata for appointment2 (check that we have 2 appointments in the metadata now)
    const appointmentId2 = generateId();
    const value2 = { status: AppointmentStatus.scheduled, start: date.future() };
    await sendBird.updateGroupChannelMetadata(params.channel_url, appointmentId2, value2);
    await validateGroupChannel(
      params.channel_url,
      [appointmentId1, appointmentId2],
      [value1, value2],
    );

    // 9. Delete metadata for appointment2
    await sendBird.deleteGroupChannelMetadata(params.channel_url, appointmentId2);
    await validateGroupChannel(params.channel_url, [appointmentId1], [value1]);

    // 10. Create another user (coach)
    const newUser = {
      user_id: v4(),
      nickname: name.firstName(),
      profile_url: image.avatar(),
      issue_access_token: true,
      metadata: { role: UserRole.coach.toLowerCase() },
    };
    await sendBird.createUser(newUser);

    // 11. replace coach in channel (leave & invite)
    const leaveResult = await sendBird.leave(params.channel_url, user.user_id);
    expect(leaveResult.data).toEqual({});

    const inviteResult = await sendBird.invite(params.channel_url, newUser.user_id);
    expect(inviteResult[0]).toEqual(newUser.user_id);
    expect(inviteResult[1]).toEqual(member.user_id);

    // 12. replace channel name and image
    const replaceResult = await sendBird.updateChannelName(
      params.channel_url,
      newUser.nickname,
      newUser.profile_url,
    );
    expect(JSON.parse(replaceResult.config.data).name).toEqual(newUser.nickname);
    expect(JSON.parse(replaceResult.config.data).cover_url).toEqual(newUser.profile_url);

    // 13. update a user
    const result = await sendBird.updateUser({
      user_id: user.user_id,
      nickname: name.firstName(),
      profile_url: image.avatar(),
    });
    expect(result).not.toBeUndefined();
    expect(result).toEqual(userResult);
  }, 30000);

  const validateGroupChannel = async (
    channelUrl: string,
    appointmentIds: string[],
    compareTo: { status: AppointmentStatus; start: Date }[],
  ) => {
    //eslint-disable-next-line @typescript-eslint/ban-ts-comment
    //@ts-ignore
    const url = `${sendBird.basePath}group_channels/${channelUrl}`;
    //eslint-disable-next-line @typescript-eslint/ban-ts-comment
    //@ts-ignore
    const current = await axios.get(url, { headers: sendBird.headers });
    const { appointments } = JSON.parse(current.data.data);

    expect(Object.keys(appointments).length).toEqual(appointmentIds.length);
    for (let i = 0; i < appointmentIds.length; i++) {
      expect(appointments[appointmentIds[i]].status).toEqual(compareTo[i].status);
      expect(new Date(appointments[appointmentIds[i]].start)).toEqual(compareTo[i].start);
    }
  };
});
