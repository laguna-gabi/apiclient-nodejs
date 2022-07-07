import { ICreateDispatch } from '@argus/irisClient';
import {
  CancelNotificationType,
  EntityName,
  Language,
  NotificationType,
  Platform,
  StorageUrlParams,
} from '@argus/pandora';
import { Field, InputType, ObjectType, registerEnumType } from '@nestjs/graphql';
import { IsAlphanumeric, IsOptional } from 'class-validator';
import { isNil, omitBy } from 'lodash';
import { Model, Types } from 'mongoose';
import {
  Alert,
  DismissedAlert,
  DismissedAlertDocument,
  ErrorType,
  Errors,
  IsNotPlatformWeb,
} from '.';
import { IsObjectId } from '@argus/hepiusClient';
import { differenceInMilliseconds, sub } from 'date-fns';
import { InjectModel, Prop } from '@nestjs/mongoose';

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

export enum RelatedEntityType {
  questionnaire = 'questionnaire',
  questionnaireResponse = 'questionnaireResponse',
  actionItem = 'actionItem',
  caregiver = 'caregiver',
  poc = 'poc',
}

registerEnumType(RelatedEntityType, { name: 'RelatedEntityType' });
@InputType('RelatedEntityInput')
@ObjectType()
export class RelatedEntity {
  @Prop({ type: String, enum: RelatedEntityType })
  @Field(() => RelatedEntityType)
  type: RelatedEntityType;

  @Prop()
  @Field(() => String, { nullable: true })
  id?: string;
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

export abstract class AlertService extends BaseService {
  protected constructor(
    @InjectModel(DismissedAlert.name)
    readonly dismissAlertModel: Model<DismissedAlertDocument>,
  ) {
    super();
  }

  abstract entityToAlerts(member, userId?: string): Promise<Alert[]>;

  async getAlerts(userId: string, members, lastQueryAlert?: Date): Promise<Alert[]> {
    const alerts = (
      await Promise.all(members?.map(async (member) => this.entityToAlerts(member, userId)))
    ).flat();

    const dismissedAlertsIds = (await this.getUserDismissedAlerts(userId)).map(
      (dismissedAlerts) => dismissedAlerts.alertId,
    );

    return alerts
      .filter((alert: Alert) => alert?.date > sub(new Date(), { days: 30 }))
      .map((alert) => {
        alert.dismissed = dismissedAlertsIds?.includes(alert.id);
        alert.isNew = !lastQueryAlert || lastQueryAlert < alert.date;

        return alert;
      })
      .sort((a1: Alert, a2: Alert) => {
        return differenceInMilliseconds(a2.date, a1.date);
      });
  }

  async dismissAlert(userId: string, alertId: string) {
    return this.dismissAlertModel.findOneAndUpdate({ alertId, userId }, undefined, {
      upsert: true,
    });
  }

  private async getUserDismissedAlerts(userId: string): Promise<DismissedAlert[]> {
    return this.dismissAlertModel.find({ userId });
  }
}

export type IInternalDispatch = Omit<ICreateDispatch, 'type' | 'serviceName'>;

export enum UpdatedAppointmentAction {
  edit = 'edit',
  delete = 'delete',
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
  multiChoice = 'multiChoice',
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
  label?: string;
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

/**************************************************************************************************
 **************************************** ACE Options *******************************************
 *************************************************************************************************/

export const defaultEntityMemberIdLocator = 'memberId';

// enum values match the strategy properties in the ace guard
export enum AceStrategy {
  custom = 'customAceStrategy', // ACE us handled downstream from guard
  token = 'byTokenStrategy', // value are populated from token (user id, member id, orgs, etc)
  rbac = 'rbacStrategy', // RBAC guard is sufficient (ACE skipped)
  byOrg = 'byOrgStrategy', // request carries org id(s) which can be validated against the client provisioned orgs
  byMember = 'byMemberStrategy', // request carries an entity id which is either a member id or can be traced back to a member
  byUser = 'byUserStrategy', // request carries an entity id which is the userId
}
export class AceOptions {
  strategy?: AceStrategy | AceStrategy[];
  /**
   * affected entity name in request
   */
  entityName?: EntityName;
  /**
   * entity id locator name in request args
   */
  idLocator?: string;
  /**
   * member id locator name in a non-member entity model. default is `memberId`
   */
  entityMemberIdLocator?: string;
}

export class AceContext {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  args: any;
  aceOptions: AceOptions;
}

/**************************************************************************************************
 **************************************** Internationalization ************************************
 *************************************************************************************************/

export enum InternalContentKey {
  newMemberNudgeAnonymous = 'newMemberNudgeAnonymous',
}

export class ExtraData {
  dynamicLink?: string;
}
