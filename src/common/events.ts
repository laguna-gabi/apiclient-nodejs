import { Platform, SlackChannel, SlackIcon, UpdatedAppointmentAction } from './interfaces.dto';
import { Types } from 'mongoose';
import { Scores, AppointmentStatus } from '../appointment';
import { Member } from '../member';
import { User } from '../user';

export enum EventType {
  requestAppointment = 'requestAppointment',
  newAppointment = 'newAppointment',
  updatedAppointment = 'updatedAppointment',
  appointmentScoresUpdated = 'appointmentScoresUpdated',
  newMember = 'newMember',
  newUser = 'newUser',
  updateMemberConfig = 'updateMemberConfig',
  updateUserConfig = 'updateUserConfig',
  addUserToMemberList = 'addUserToMemberList',
  updateMemberPlatform = 'updateMemberPlatform',
  internalNotify = 'internalNotify',
  notifyChatMessage = 'notifyChatMessage',
  slackMessage = 'slackMessage',
}

export interface IEventRequestAppointment {
  user: User;
  member: Member;
}

export interface IEventNewAppointment {
  userId: string;
  appointmentId: string;
}

export interface IEventUpdatedAppointment {
  memberId: string;
  userId: string;
  key: string;
  value?: { status: AppointmentStatus; start: Date };
  updatedAppointmentAction: UpdatedAppointmentAction;
}

export interface IEventAppointmentScoresUpdated {
  memberId: Types.ObjectId;
  scores: Scores;
}

export interface IEventNewMember {
  member: Member;
  user: User;
  platform: Platform;
}

export interface IEventNewUser {
  user: User;
}

export interface IEventUpdateMemberConfig {
  memberId: string;
  accessToken?: string;
}

export interface IEventUpdateUserConfig {
  userId: string;
  accessToken: string;
}

export interface IEventAddUserToMemberList {
  memberId: string;
  userId: string;
}

export interface IEventUpdateMemberPlatform {
  memberId: string;
  userId: string;
  platform: Platform;
}

export interface IEventNotifyChatMessage {
  senderUserId: string;
  sendbirdChannelUrl: string;
}

export interface IEventSlackMessage {
  message: string;
  icon: SlackIcon;
  channel: SlackChannel;
}
