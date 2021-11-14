import { Types } from 'mongoose';
import { Appointment, AppointmentStatus, Scores } from '../appointment';
import { Member } from '../member';
import { User } from '../user';
import {
  AllNotificationTypes,
  Platform,
  QueueType,
  SlackChannel,
  SlackIcon,
  UpdatedAppointmentAction,
} from '.';

export enum EventType {
  requestAppointment = 'requestAppointment',
  newAppointment = 'newAppointment',
  updatedAppointment = 'updatedAppointment',
  appointmentScoresUpdated = 'appointmentScoresUpdated',
  newMember = 'newMember',
  newUser = 'newUser',

  updateUserInCommunication = 'updateUserInCommunication',
  updateUserInAppointments = 'updateUserInAppointments',
  updateAppointmentsInUser = 'updateAppointmentsInUser',

  updateMemberConfig = 'updateMemberConfig',
  updateUserConfig = 'updateUserConfig',
  addUserToMemberList = 'addUserToMemberList',
  updateMemberPlatform = 'updateMemberPlatform',
  internalNotify = 'internalNotify',
  notifyChatMessage = 'notifyChatMessage',
  sendSmsToChat = 'sendSmsToChat',
  slackMessage = 'slackMessage',
  queueMessage = 'queueMessage',
  deleteSchedules = 'deleteSchedules',
  deleteMember = 'deleteMember',
  removeAppointmentsFromUser = 'removeAppointmentsFromUser',
  unregisterMemberFromNotifications = 'unregisterMemberFromNotifications',
  deleteLogReminder = 'deleteLogReminder',

  unconsentedAppointmentEnded = 'unconsentedAppointmentEnded',
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
  sendBirdChannelUrl: string;
  sendBirdMemberInfo?: { memberId: string; isOnline: boolean }[];
}

export interface IEventSendSmsToChat {
  phone: string;
  message: string;
}

export interface IEventSlackMessage {
  message: string;
  icon: SlackIcon;
  channel: SlackChannel;
}

export interface IEventQueueMessage {
  type: QueueType;
  message: string;
}

export interface IEventDeleteSchedules {
  memberId: string;
}

export interface IEventUnregisterMemberFromNotifications {
  phone: string;
  content: string;
  type: AllNotificationTypes;
}
export interface IEventUnconsentedAppointmentEnded {
  appointmentId: string;
  memberId: string;
}

export interface IEventUpdateUserInCommunication {
  newUser: User;
  oldUserId: string;
  member: Member;
  platform: Platform;
}

export interface IEventUpdateUserInAppointments {
  newUserId: string;
  oldUserId: string;
  memberId: string;
}

export interface IEventUpdateAppointmentsInUser extends IEventUpdateUserInAppointments {
  appointments: Appointment[];
}
