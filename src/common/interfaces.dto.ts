import { Field, InputType, ObjectType, registerEnumType } from '@nestjs/graphql';
import { Schema } from '@nestjs/mongoose';
import { IsAlphanumeric, IsOptional } from 'class-validator';
import { Types } from 'mongoose';
import { IsNotPlatformWeb } from './customValidators';
import { ErrorType, Errors } from './errors';

/**************************************************************************************************
 ******************************* Enum registration for gql methods ********************************
 *************************************************************************************************/
export enum Language {
  en = 'en',
  es = 'es',
}

registerEnumType(Language, { name: 'Language' });

export enum NotificationType {
  video = 'video',
  call = 'call',
  text = 'text',
  textSms = 'textSms',
}

registerEnumType(NotificationType, { name: 'NotificationType' });

export enum CancelNotificationType {
  cancelVideo = 'cancelVideo',
  cancelCall = 'cancelCall',
  cancelText = 'cancelText',
}

registerEnumType(CancelNotificationType, { name: 'CancelNotificationType' });

export enum InternalNotificationType {
  textToMember = 'textToMember',
  textSmsToMember = 'textSmsToMember',
  textSmsToUser = 'textSmsToUser',
  chatMessageToMember = 'chatMessageToMember',
  chatMessageToUser = 'chatMessageToUser',
}

export enum Platform {
  ios = 'ios',
  android = 'android',
  web = 'web',
}

registerEnumType(Platform, { name: 'Platform' });

export enum AppointmentStatus {
  requested = 'requested',
  scheduled = 'scheduled',
  done = 'done',
}

registerEnumType(AppointmentStatus, { name: 'AppointmentStatus' });

/**************************************************************************************************
 ********************************** Input params for gql methods **********************************
 *************************************************************************************************/

@ObjectType()
@Schema()
export class Identifier {
  @Field(() => String)
  id: string;
}

@ObjectType()
export class Identifiers {
  @Field(() => [String])
  ids: string[];
}

@InputType()
export class RegisterForNotificationParams {
  @Field(() => String)
  memberId: string;

  @IsNotPlatformWeb({ message: Errors.get(ErrorType.memberRegisterWebPlatform) })
  @Field(() => Platform)
  platform: Platform;

  @Field(() => String, { nullable: true })
  @IsOptional()
  /**
   * https://documentation.onesignal.com/reference/add-a-device : this api
   * generates a 400 http error if token is non alphanumeric (for example a_b-c)
   */
  @IsAlphanumeric(undefined, { message: Errors.get(ErrorType.memberRegisterForNotificationToken) })
  token?: string;

  @Field(() => Boolean, { nullable: true })
  @IsOptional()
  isPushNotificationsEnabled?: boolean;
}

/**************************************************************************************************
 ******************************************** Internals *******************************************
 *************************************************************************************************/
export abstract class BaseService {
  replaceId(object) {
    if (!object) {
      return object;
    }
    object.id = new Types.ObjectId(object._id);
    delete object._id;

    return object;
  }

  removeNotNullable(object, keys: string[]) {
    keys.forEach((key) => {
      if (object[key] === null) {
        delete object[key];
      }
    });
  }
}

export class InternalNotificationMetadata {
  content: string;
  chatLink?: string;
  sendBirdChannelUrl?: string;
  appointmentTime?: Date;
}

export class InternalNotifyParams {
  memberId?: string;
  userId: string;
  type: InternalNotificationType;
  metadata: InternalNotificationMetadata;
}

export type AllNotificationTypes =
  | NotificationType
  | CancelNotificationType
  | InternalNotificationType;

export class BaseSendNotification {
  orgName?: string;
}

export class SendOneSignalNotification extends BaseSendNotification {
  platform: Platform;
  externalUserId: string;
  data: {
    user: {
      id: string;
      firstName: string;
      avatar: string;
    };
    member: { phone: string };
    peerId?: string;
    type: AllNotificationTypes;
    path?: string;
    isVideo: boolean;
  };
  metadata: Record<string, any>;
}

export class SendTwilioNotification extends BaseSendNotification {
  body: string;
  to: string;
}

export class SendSendBirdNotification extends BaseSendNotification {
  userId: string; //sender
  sendBirdChannelUrl: string;
  message: string;
  notificationType: AllNotificationTypes;
}

export class CancelNotificationParams extends BaseSendNotification {
  externalUserId: string;
  platform: Platform;
  data: {
    peerId?: string;
    type: CancelNotificationType;
    notificationId: string;
  };
}

export enum SlackChannel {
  support = 'slack.support',
  testingSms = 'slack.testingSms',
  notifications = 'slack.notifications',
}

export enum SlackIcon {
  phone = ':telephone_receiver:',
  info = ':information_source:',
  warning = ':warning:',
  critical = ':no_entry:',
  exclamationPoint = ':exclamation:',
  questionMark = ':question:',
}

export enum UpdatedAppointmentAction {
  edit = 'edit',
  delete = 'delete',
}

export enum StorageType {
  documents = 'documents',
  recordings = 'recordings',
}

export enum ReminderType {
  appointmentReminder = '_appointmentReminder',
  appointmentLongReminder = '_appointmentLongReminder',
}

export interface StorageUrlParams {
  storageType: StorageType;
  memberId: string;
  id: string;
}

export enum Environments {
  production = 'production',
  development = 'development',
  test = 'test',
}

export enum QueueType {
  audit = 'audit',
}

export enum AuditType {
  write = 'write',
  read = 'read',
  archive = 'archive',
  message = 'message',
}
