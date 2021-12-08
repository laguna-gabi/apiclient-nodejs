import { Types } from 'mongoose';
import { Appointment, AppointmentDocument, AppointmentStatus, Scores } from '../appointment';
import { Member } from '../member';
import { User } from '../user';
import { AllNotificationTypes, QueueType, UpdatedAppointmentAction } from '.';
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

  //user
  onNewUser = 'onNewUser',
  onUpdatedUserCommunication = 'onUpdatedUserCommunication',
  onUpdatedUserConfig = 'onUpdatedUserConfig',

  //appointments
  onNewAppointment = 'onNewAppointment',
  onUpdatedAppointment = 'onUpdatedAppointment',
  onUpdatedAppointmentScores = 'onUpdatedAppointmentScores',
  onUpdatedUserAppointments = 'onUpdatedUserAppointments',
  onUnconsentedAppointmentEnded = 'onUnconsentedAppointmentEnded',
  onDeletedMemberAppointments = 'onDeletedMemberAppointments',

  //notifications
  onReceivedChatMessage = 'onReceivedChatMessage',
  onReceivedTextMessage = 'onReceivedTextMessage',
  notifyInternal = 'notifyInternal',
  notifyInternalControlMember = 'notifyInternalControlMember',
  notifySlack = 'notifySlack',
  notifyQueue = 'notifyQueue',
  notifyDispatch = 'notifyDispatch',

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

/*************************************************************************************************
 **************************************** User interfaces ****************************************
 *************************************************************************************************/
export interface IEventOnNewUser {
  user: User;
}

export interface IEventOnUpdatedUserCommunication extends IEventMember {
  newUserId: string;
  oldUserId: string;
}

export interface IEventOnUpdateUserConfig {
  userId: string;
  accessToken: string;
}

/*************************************************************************************************
 ************************************* Appointment interfaces ************************************
 *************************************************************************************************/
export interface IEventOnNewAppointment extends IEventMember {
  userId: string;
  appointmentId: string;
}

export interface IEventOnUpdatedAppointment extends IEventMember {
  userId: string;
  key: string;
  value?: { status: AppointmentStatus; start: Date };
  updatedAppointmentAction: UpdatedAppointmentAction;
}

export interface IEventOnUpdatedAppointmentScores {
  memberId: Types.ObjectId;
  scores: Scores;
}

export interface IEventOnUpdatedUserAppointments extends IEventOnUpdatedUserCommunication {
  appointments: Appointment[];
}

export interface IEventUnconsentedAppointmentEnded extends IEventMember {
  appointmentId: string;
}

export interface IEventOnDeletedMemberAppointments {
  appointments: AppointmentDocument[];
}

/*************************************************************************************************
 ************************************ Notification interfaces ************************************
 *************************************************************************************************/
export interface IEventOnReceivedChatMessage {
  senderUserId: string;
  sendBirdChannelUrl: string;
  sendBirdMemberInfo?: { memberId: string; isOnline: boolean }[];
}

export interface IEventOnReceivedTextMessage {
  phone: string;
  message: string;
}

export interface IEventNotifyQueue {
  type: QueueType;
  message: string;
}
