import {
  CancelNotificationType,
  ICreateDispatch,
  Language,
  NotificationType,
  Platform,
} from '@argus/pandora';
import { Field, InputType, ObjectType, registerEnumType } from '@nestjs/graphql';
import { Schema } from '@nestjs/mongoose';
import { IsAlphanumeric, IsOptional } from 'class-validator';
import { Types } from 'mongoose';
import { ErrorType, Errors, IsNotPlatformWeb, IsObjectId } from '.';
import { isNil, omitBy } from 'lodash';

/**************************************************************************************************
 *************************** Enum registration for external gql methods ***************************
 *************************************************************************************************/
registerEnumType(CancelNotificationType, { name: 'CancelNotificationType' });
registerEnumType(NotificationType, { name: 'NotificationType' });
registerEnumType(Platform, { name: 'Platform' });
registerEnumType(Language, { name: 'Language' });

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
    return omitBy(object, (val, key: string) => keys.includes(key) && isNil(val));
  }
}

export type IInternalDispatch = Omit<ICreateDispatch, 'type' | 'serviceName'>;

export enum UpdatedAppointmentAction {
  edit = 'edit',
  delete = 'delete',
}

export enum StorageType {
  documents = 'documents',
  recordings = 'recordings',
  journals = 'journals',
  general = 'general',
}

export interface StorageUrlParams {
  storageType: StorageType;
  memberId: string;
  id: string;
}
export interface MultipartUploadUrlParams extends StorageUrlParams {
  partNumber: number;
  uploadId?: string;
}
export interface CompleteMultipartUploadUrlParams extends StorageUrlParams {
  uploadId: string;
}

export enum RecordingType {
  voip = 'voip',
  video = 'video',
  phone = 'phone',
}
registerEnumType(RecordingType, {
  name: 'RecordingType',
});

export enum MemberIdParamType {
  memberId = 'memberId',
  id = 'id',
}

export type PhoneType = 'landline' | 'mobile' | 'voip';

export enum ChangeType {
  create = 'create',
  update = 'update',
  delete = 'delete',
}
registerEnumType(ChangeType, { name: 'ChangeType' });

/**************************************************************************************************
 **************************************** Questionnaire *******************************************
 *************************************************************************************************/

export enum ItemType {
  choice = 'choice',
  text = 'text',
  range = 'range',
  group = 'group',
}

export interface ItemInterface {
  code: string;
  label: string;
  type: ItemType;
  order: number;
  required: boolean;
  options?: OptionInterface[];
  range?: RangeInterface;
  items?: ItemInterface[];
}

export interface OptionInterface {
  label: string;
  value: number;
}
export interface RangeInterface {
  min: RangeElementInterface;
  max: RangeElementInterface;
}
export interface RangeElementInterface {
  value: number;
  label: string;
}

export interface SeverityLevelInterface {
  min: number;
  max: number;
  label: string;
}
