import {
  CancelNotificationType,
  ContentKey,
  ExtraData,
  InternalNotificationType,
  Language,
  NotificationType,
  Platform,
} from '@lagunahealth/pandora';
import { Field, InputType, ObjectType, registerEnumType } from '@nestjs/graphql';
import { Schema } from '@nestjs/mongoose';
import { IsAlphanumeric, IsOptional } from 'class-validator';
import { Types } from 'mongoose';
import { ErrorType, Errors, IsNotPlatformWeb } from '.';

/**************************************************************************************************
 *************************** Enum registration for external gql methods ***************************
 *************************************************************************************************/
registerEnumType(CancelNotificationType, { name: 'CancelNotificationType' });
registerEnumType(InternalNotificationType, { name: 'InternalNotificationType' });
registerEnumType(NotificationType, { name: 'NotificationType' });
registerEnumType(Platform, { name: 'Platform' });
registerEnumType(Language, { name: 'Language' });

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
  @IsOptional()
  @Field(() => String, { nullable: true })
  memberId?: string;

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
  contentType?: ContentKey;
  extraData?: ExtraData;
  chatLink?: string;
  scheduleLink?: string;
  sendBirdChannelUrl?: string;
  appointmentTime?: Date;
  appointmentId?: string;
  triggersAt?: Date;
  checkAppointmentReminder?: boolean;
  path?: string;
  journalImageDownloadLink?: string;
}

export class InternalNotifyParams {
  memberId: string;
  userId: string;
  type: InternalNotificationType;
  metadata: InternalNotificationMetadata;
  content?: string;
}

export class IDispatchParams extends InternalNotifyParams {
  dispatchId: string;
  correlationId?: string;
}

export type InternalNotifyControlMemberParams = Omit<InternalNotifyParams, 'userId'>;

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
    extraData?: string; //flush data to then client
  };
  content?: string;
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
  appointmentId?: string;
  journalImageDownloadLink?: string;
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

export enum UpdatedAppointmentAction {
  edit = 'edit',
  delete = 'delete',
}

export enum StorageType {
  documents = 'documents',
  recordings = 'recordings',
  journals = 'journals',
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
  notifications = 'notifications',
}

export enum AuditType {
  write = 'write',
  read = 'read',
  archive = 'archive',
  delete = 'delete',
  message = 'message',
  userReplaced = 'userReplaced',
}

export enum RecordingType {
  voip = 'voip',
  video = 'video',
  phone = 'phone',
}

registerEnumType(RecordingType, {
  name: 'RecordingType',
});
