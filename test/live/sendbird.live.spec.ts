import { ConfigsService, SendBird } from '../../src/providers';
import { v4 } from 'uuid';
import * as faker from 'faker';
import { CreateSendbirdGroupChannelParams } from '../../src/communication';
import { UserRole } from '../../src/user';
import { generateId } from '../generators';
import { AppointmentStatus } from '../../src/appointment';
import axios from 'axios';

describe('live: sendbird actions', () => {
  let sendBird: SendBird;

  beforeAll(async () => {
    const configService = new ConfigsService();
    sendBird = new SendBird(configService);
    await sendBird.onModuleInit();
  });

  /**
   * Flow:
   * 1. create a user (coach)
   * 2. create a user (member)
   * 3. create a group channel between user(coach) and user(member)
   * 4. freeze group channel
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
    await sendBird.freezeGroupChannel(params.channel_url, false);

    const appointmentId1 = generateId();
    const value1 = { status: AppointmentStatus.scheduled, start: faker.date.future() };
    await sendBird.updateGroupChannelMetadata(params.channel_url, appointmentId1, value1);
    const { appointments: appointments1 } = await getData(params.channel_url);
    expect(Object.keys(appointments1).length).toEqual(1);
    expect(appointments1[appointmentId1].status).toEqual(value1.status);
    expect(new Date(appointments1[appointmentId1].start)).toEqual(value1.start);

    const appointmentId2 = generateId();
    const value2 = { status: AppointmentStatus.scheduled, start: faker.date.future() };
    await sendBird.updateGroupChannelMetadata(params.channel_url, appointmentId2, value2);
    const { appointments: appointments2 } = await getData(params.channel_url);
    expect(Object.keys(appointments2).length).toEqual(2);
    expect(appointments2[appointmentId1].status).toEqual(value1.status);
    expect(new Date(appointments2[appointmentId1].start)).toEqual(value1.start);
    expect(appointments2[appointmentId2].status).toEqual(value2.status);
    expect(new Date(appointments2[appointmentId2].start)).toEqual(value2.start);

    await sendBird.deleteGroupChannelMetadata(params.channel_url, appointmentId2);
    const { appointments: appointments3 } = await getData(params.channel_url);
    expect(Object.keys(appointments3).length).toEqual(1);
    expect(appointments3[appointmentId1].status).toEqual(value1.status);
    expect(new Date(appointments3[appointmentId1].start)).toEqual(value1.start);
  }, 20000);

  const getData = async (channelUrl: string) => {
    const url = `${sendBird.basePath}group_channels/${channelUrl}`;
    const current = await axios.get(url, { headers: sendBird.headers });
    return JSON.parse(current.data.data);
  };
});
