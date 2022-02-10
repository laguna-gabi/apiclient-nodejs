import { Platform, QueueType } from '@lagunahealth/pandora';
import { Types } from 'mongoose';
import { UpdatedAppointmentAction } from '.';
import { Appointment, AppointmentDocument, AppointmentStatus, Scores } from '../appointment';
import { Member } from '../member';
import { User } from '../user';

export enum EventType {
  //member
  onNewMember = 'onNewMember',
  onNewMemberCommunication = 'onNewMemberCommunication',
  onUpdatedMemberPlatform = 'onUpdatedMemberPlatform',
  onReplacedUserForMember = 'onReplacedUserForMember',
  onDeletedMember = 'onDeletedMember',

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
  notifySlack = 'notifySlack',
  notifyQueue = 'notifyQueue',
  notifyDispatch = 'notifyDispatch',
  notifyDeleteDispatch = 'notifyDeleteDispatch',

  // questionnaire
  onAlertForQRSubmit = 'onAlertForQRSubmit',
}

/*************************************************************************************************
 *************************************** Member interfaces ***************************************
 *************************************************************************************************/
export interface IEventMember {
  memberId: string;
}

export interface IEventDeleteMember extends IEventMember {
  deletedBy: string;
  hard: boolean;
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

export interface IEventOnAlertForQRSubmit extends IEventMember {
  questionnaireName: string;
  score: string | number;
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
}

export interface IEventOnReceivedTextMessage {
  phone: string;
  message: string;
}

export interface IEventNotifyQueue {
  type: QueueType;
  message: string;
}
