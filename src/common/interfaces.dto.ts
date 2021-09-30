import { Field, InputType, ObjectType, registerEnumType } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { IsAlphanumeric, IsOptional } from 'class-validator';
import { Errors, ErrorType } from '.';
import { IsTypeMetadataProvided } from './customValidators';

/**************************************************************************************************
 ******************************* Enum registration for gql methods ********************************
 *************************************************************************************************/
export enum Language {
  en = 'en',
  es = 'es',
}

registerEnumType(Language, { name: 'Language' });

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

/************************************************************************************************
 ***************************************** Notifications ****************************************
 ************************************************************************************************/

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
@InputType()
export class NotificationMetadata {
  @Field(() => String, { nullable: true })
  peerId?: string;

  @Field(() => String, { nullable: true })
  content?: string;

  @Field(() => Date, { nullable: true })
  when?: Date;
}

@Schema({ versionKey: false, timestamps: true })
@InputType()
export class NotifyParams {
  @Prop()
  @Field(() => String)
  userId: string;

  @Prop()
  @Field(() => String)
  memberId: string;

  @IsTypeMetadataProvided({ message: Errors.get(ErrorType.notificationMetadataInvalid) })
  @Field(() => NotificationType)
  @Prop()
  type: NotificationType;

  @Prop()
  @Field(() => NotificationMetadata)
  metadata: NotificationMetadata;
}

@InputType()
export class CancelNotificationMetadata {
  @Field(() => String, { nullable: true })
  peerId?: string;
}

@InputType()
export class CancelNotifyParams {
  @Field(() => String)
  memberId: string;

  @IsTypeMetadataProvided({ message: Errors.get(ErrorType.notificationMetadataInvalid) })
  @Field(() => CancelNotificationType)
  type: CancelNotificationType;

  @Field(() => String)
  notificationId: string;

  @Field(() => CancelNotificationMetadata)
  metadata: CancelNotificationMetadata;
}

export type NotifyParamsDocument = NotifyParams & Document;
export const NotifyParamsDto = SchemaFactory.createForClass(NotifyParams);

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

export class SendNotificationToMemberParams {
  externalUserId: string;
  platform: Platform;
  isPushNotificationsEnabled: boolean;
  data: {
    user: {
      id: string;
      firstName: string;
      avatar: string;
    };
    member: {
      phone: string;
    };
    peerId?: string;
    type: NotificationType;
    path?: string;
    isVideo: boolean;
  };
  metadata: Record<string, any>;
}

export class SendNotificationToUserParams {
  data: {
    user: {
      phone: string;
    };
  };
  metadata: Record<string, any>;
}

export class CancelNotificationParams {
  externalUserId: string;
  platform: Platform;
  isPushNotificationsEnabled: boolean;
  data: {
    peerId?: string;
    type: CancelNotificationType;
    notificationId: string;
  };
}

export enum slackChannel {
  support = 'slack.support',
  testingSms = 'slack.testingSms',
  notifications = 'slack.notifications',
}

export enum SlackIcon {
  exclamationPoint = ':exclamation:',
  questionMark = ':question:',
  phone = ':telephone_receiver:',
  info = ':information_source:',
  warning = ':warning:',
  critical = ':no_entry:',
}

export enum UpdatedAppointmentAction {
  edit = 'edit',
  delete = 'delete',
}

export enum StorageType {
  documents = 'documents',
  recordings = 'recordings',
}

export interface StorageUrlParams {
  storageType: StorageType;
  memberId: string;
  id: string;
}
