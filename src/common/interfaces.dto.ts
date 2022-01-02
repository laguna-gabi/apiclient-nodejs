import {
  AllNotificationTypes,
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
import { ErrorType, Errors, IsNotPlatformWeb, IsObjectId } from '.';

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
  @IsObjectId({ message: Errors.get(ErrorType.memberIdInvalid) })
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
  peerId?: string;
  journalImageDownloadLink?: string;
  journalAudioDownloadLink?: string;
}

export class IDispatchParams {
  dispatchId: string;
  correlationId?: string;
  memberId: string;
  userId?: string;
  type: AllNotificationTypes;
  metadata: InternalNotificationMetadata;
  content?: string;
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

export enum RecordingType {
  voip = 'voip',
  video = 'video',
  phone = 'phone',
}

registerEnumType(RecordingType, {
  name: 'RecordingType',
});
