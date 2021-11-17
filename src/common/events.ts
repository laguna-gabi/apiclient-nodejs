import { Types } from 'mongoose';
import { Appointment, AppointmentStatus, Scores } from '../appointment';
import { Member } from '../member';
import { User } from '../user';
import {
  AllNotificationTypes,
  QueueType,
  SlackChannel,
  SlackIcon,
  UpdatedAppointmentAction,
} from '.';
import { Platform } from '@lagunahealth/pandora';

export enum EventType {
  //member
  onNewMember = 'onNewMember',
  onNewMemberCommunication = 'onNewMemberCommunication',
  onUpdatedMemberPlatform = 'onUpdatedMemberPlatform',
  onReplacedUserForMember = 'onReplacedUserForMember',
  onMemberBecameOffline = 'onMemberBecameOffline',
  onDeletedMember = 'onDeletedMember',
  onArchivedMember = 'onArchivedMember',

  requestAppointment = 'requestAppointment',
  newAppointment = 'newAppointment',
  updatedAppointment = 'updatedAppointment',
  appointmentScoresUpdated = 'appointmentScoresUpdated',
  newUser = 'newUser',

  updateUserInAppointments = 'updateUserInAppointments',
  updateAppointmentsInUser = 'updateAppointmentsInUser',

  updateUserConfig = 'updateUserConfig',
  addUserToMemberList = 'addUserToMemberList',
  internalNotify = 'internalNotify',
  notifyChatMessage = 'notifyChatMessage',
  sendSmsToChat = 'sendSmsToChat',
  slackMessage = 'slackMessage',
  queueMessage = 'queueMessage',
  removeAppointmentsFromUser = 'removeAppointmentsFromUser',

  unconsentedAppointmentEnded = 'unconsentedAppointmentEnded',

  //daily logs
  onSetDailyLogCategories = 'onSetDailyLogCategories',
}

/*************************************************************************************************
 *************************************** Member interfaces ***************************************
 *************************************************************************************************/
export interface IEventMember {
  memberId: string;
}

export interface IEventOnNewMember {
  member: Member;
  user: User;
  platform: Platform;
}

export interface IEventOnNewMemberCommunication extends IEventMember {
  accessToken?: string;
}

export interface IEventOnUpdatedMemberPlatform extends IEventMember {
  userId: string;
  platform: Platform;
}

export interface IEventOnReplacedUserForMember {
  newUser: User;
  oldUserId: string;
  member: Member;
  platform: Platform;
}

export interface IEventOnMemberBecameOffline {
  phone: string;
  content: string;
  type: AllNotificationTypes;
}

export interface IEventRequestAppointment {
  user: User;
  member: Member;
}

export interface IEventNewAppointment {
  userId: string;
  appointmentId: string;
}

export interface IEventUpdatedAppointment extends IEventMember {
  userId: string;
  key: string;
  value?: { status: AppointmentStatus; start: Date };
  updatedAppointmentAction: UpdatedAppointmentAction;
}

export interface IEventAppointmentScoresUpdated {
  memberId: Types.ObjectId;
  scores: Scores;
}

export interface IEventNewUser {
  user: User;
}

export interface IEventUpdateUserConfig {
  userId: string;
  accessToken: string;
}

export interface IEventAddUserToMemberList extends IEventMember {
  userId: string;
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

export interface IEventUnconsentedAppointmentEnded extends IEventMember {
  appointmentId: string;
}

export interface IEventUpdateUserInAppointments extends IEventMember {
  newUserId: string;
  oldUserId: string;
  memberId: string;
}

export interface IEventUpdateAppointmentsInUser extends IEventUpdateUserInAppointments {
  appointments: Appointment[];
}
