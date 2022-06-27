import { Platform, QueueType } from '@argus/pandora';
import { HealthPersona, QuestionnaireResponse, QuestionnaireType } from '../questionnaire';
import { RelatedEntity, UpdatedAppointmentAction } from '.';
import { AppointmentDocument } from '../appointment';
import { Member } from '../member';
import { Appointment, AppointmentStatus, Scores, User } from '@argus/hepiusClient';
import { Org } from '../org';

export enum EventType {
  //member
  onNewMember = 'onNewMember',
  onNewMemberCommunication = 'onNewMemberCommunication',
  onUpdatedMemberPlatform = 'onUpdatedMemberPlatform',
  onReplacedUserForMember = 'onReplacedUserForMember',
  onDeletedMember = 'onDeletedMember',
  onPublishedJournal = 'onPublishedJournal',
  onReplaceMemberOrg = 'onReplaceMemberOrg',
  onFirstAppointment = 'onFirstAppointment',

  //user
  onNewUser = 'onNewUser',
  onUpdatedUser = 'onUpdatedUser',
  onUpdatedUserCommunication = 'onUpdatedUserCommunication',
  onUpdatedUserConfig = 'onUpdatedUserConfig',

  //appointments
  onNewAppointment = 'onNewAppointment',
  onUpdatedAppointment = 'onUpdatedAppointment',
  onUpdatedAppointmentScores = 'onUpdatedAppointmentScores',
  onUpdatedUserAppointments = 'onUpdatedUserAppointments',
  onDeletedMemberAppointments = 'onDeletedMemberAppointments',

  //notifications
  onReceivedChatMessage = 'onReceivedChatMessage',
  onReceivedTextMessage = 'onReceivedTextMessage',
  notifyDispatch = 'notifyDispatch',
  notifyDeleteDispatch = 'notifyDeleteDispatch',

  // questionnaire
  onAlertForQRSubmit = 'onAlertForQRSubmit',
  onUpdateHealthPersona = 'onUpdateHealthPersona',
  onQRSubmit = 'onQRSubmit',

  // general
  onUpdateRelatedEntity = 'onUpdateRelatedEntity',
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

export interface IEventOnPublishedJournal {
  memberId: string;
  text: string;
  journalImageDownloadLink?: string;
  journalAudioDownloadLink?: string;
}

export interface IEventOnReplaceMemberOrg {
  memberId: string;
  org: Org;
}

export interface IEventOnFirstAppointment {
  memberId: string;
  appointmentId: string;
}
/*************************************************************************************************
 **************************************** User interfaces ****************************************
 *************************************************************************************************/
export interface IEventOnNewUser {
  user: User;
}

export type IEventOnUpdatedUser = IEventOnNewUser;

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
  questionnaireType: QuestionnaireType;
  questionnaireResponseId: string;
  score: string | number;
}

export interface IEventOnUpdatedAppointment extends IEventMember {
  userId: string;
  key: string;
  value?: { status: AppointmentStatus; start: Date };
  updatedAppointmentAction: UpdatedAppointmentAction;
}

export interface IEventOnUpdatedAppointmentScores {
  memberId: string;
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
 *********************************** Questionnaire interfaces ************************************
 *************************************************************************************************/
export interface IEventOnQRSubmit extends IEventMember {
  journeyId: string;
  questionnaireName: string;
  questionnaireType: QuestionnaireType;
  questionnaireResponse: QuestionnaireResponse;
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

export interface IEventUpdateHealthPersona {
  memberId: string;
  healthPersona: HealthPersona;
}

export interface IEventUpdateRelatedEntity {
  destEntity: RelatedEntity;
  sourceEntity: RelatedEntity;
}
