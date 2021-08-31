import { Field, InputType, ObjectType, registerEnumType } from '@nestjs/graphql';
import { Schema } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { IsAlphanumeric, IsOptional } from 'class-validator';
import { Errors, ErrorType } from './errors';

/**************************************************************************************************
 ******************************* Enum registration for gql methods ********************************
 *************************************************************************************************/
export enum Language {
  en = 'en',
  es = 'es',
}

registerEnumType(Language, { name: 'Language' });

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

export enum NotificationType {
  video = 'video',
  call = 'call',
  text = 'text',
}

registerEnumType(NotificationType, { name: 'NotificationType' });

export enum Platform {
  ios = 'ios',
  android = 'android',
  web = 'web',
}

registerEnumType(Platform, { name: 'Platform' });

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
}

/**************************************************************************************************
 ******************************************** Others  *********************************************
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

export class Input {
  en: string;
  es?: string;
}

export class NotificationPayload {
  contents?: Input;
  heading: Input;
}

export class SendNotificationParams {
  externalUserId: string;
  platform: Platform;
  payload: NotificationPayload;
  data: {
    user: {
      id: string;
      firstName: string;
      avatar: string;
    };
    peerId: string;
    type: NotificationType;
  };
}
