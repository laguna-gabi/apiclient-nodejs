import {
  AppointmentStatus,
  Identifier,
  IsObjectId,
  MemberRole,
  Scores,
  User,
} from '@argus/hepiusClient';
import { ExternalKey } from '@argus/irisClient';
import { CancelNotificationType, Language, NotificationType } from '@argus/pandora';
import { Field, InputType, ObjectType, registerEnumType } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPhoneNumber,
  IsString,
  Length,
  Matches,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import { graphql, twilio } from 'config';
import { Document, Types } from 'mongoose';
import * as mongooseDelete from 'mongoose-delete';
import { ActionItem, ReadmissionRisk, ReadmissionRiskHistory } from '../journey';
import {
  ErrorType,
  Errors,
  IsContentMetadataProvided,
  IsNotChat,
  IsOnlyDate,
  IsPastDate,
  IsTypeMetadataProvided,
  IsValidZipCode,
  PhoneType,
  maxLength,
  minLength,
  onlyDateRegex,
  validPhoneExamples,
} from '../common';
import { ISoftDelete, audit, useFactoryOptions } from '../db';
import { Org } from '../org';
import { HealthPersona } from '../questionnaire';

/**************************************************************************************************
 ******************************* Enum registration for gql methods ********************************
 *************************************************************************************************/
registerEnumType(MemberRole, { name: 'MemberRole' });
registerEnumType(ExternalKey, { name: 'ExternalKey' });

export enum Sex {
  male = 'male',
  female = 'female',
  other = 'other',
}

registerEnumType(Sex, { name: 'Sex' });

export enum Honorific {
  mr = 'mr',
  mrs = 'mrs',
  ms = 'ms',
  miss = 'miss',
  mx = 'mx',
  dr = 'dr',
  reverend = 'reverend',
  professor = 'professor',
  captain = 'captain',
  coach = 'coach',
  father = 'father',
}

registerEnumType(Honorific, { name: 'Honorific' });

export enum Race {
  americanIndianOrAlaskaNative = 'American Indian or Alaska Native',
  asian = 'Asian',
  hispanicOrLatino = 'Hispanic or Latino',
  nativeHawaiianOrOtherPacificIslander = 'Native Hawaiian or Other Pacific Islander',
  white = 'White',
}

registerEnumType(Race, { name: 'Race' });

export enum DischargeDocumentType {
  Summary = 'Summary',
  Instructions = 'Instructions',
}

registerEnumType(DischargeDocumentType, { name: 'DischargeDocumentType' });

export enum MaritalStatus {
  married = 'married',
  single = 'single',
  divorced = 'divorced',
  widowed = 'widowed',
  lifePartnership = 'life partnership',
}

registerEnumType(MaritalStatus, { name: 'MaritalStatus' });

export const defaultMemberParams = {
  sex: Sex.male,
  language: Language.en,
  honorific: Honorific.mx,
  roles: [MemberRole.member],
  race: Race.white,
};

export const NotNullableMemberKeys = [
  'firstName',
  'lastName',
  'dateOfBirth',
  'sex',
  'email',
  'language',
  'honorific',
];

export const EmbeddedMemberProperties = ['address', 'deceased'];

export enum ChatMessageOrigin {
  fromUser = 'fromUser',
  fromMember = 'fromMember',
}

const deprecationReason = 'this field was moved to journey api - please use it instead';

@InputType('AddressInput')
@ObjectType()
export class Address {
  @Field(() => String, { nullable: true })
  street?: string;

  @Field(() => String, { nullable: true })
  city?: string;

  @Field(() => String, { nullable: true })
  state?: string;
}

@InputType('DeceasedInput')
@ObjectType()
export class Deceased {
  @Field(() => String, { nullable: true })
  cause?: string;

  @Field(() => String, { nullable: true })
  date?: string;
}

/**************************************************************************************************
 ********************************** Input params for gql methods **********************************
 *************************************************************************************************/
@InputType({ isAbstract: true })
export class ExtraMemberParams {
  @Field(() => Sex, { nullable: true })
  @IsEnum(Sex) /* for rest api */
  @IsOptional()
  sex?: Sex;

  @Field(() => String, { nullable: true })
  @IsEmail(undefined, {
    message: Errors.get(ErrorType.memberEmailFormat),
  })
  @IsString() /* for rest api */
  @IsOptional()
  email?: string;

  @Field(() => String, { nullable: true })
  @IsValidZipCode({ message: Errors.get(ErrorType.memberInvalidZipCode) })
  @IsString() /* for rest api */
  @IsOptional()
  zipCode?: string;

  /**
   * will be @deprecated soon
   * use admission.dto.ts instead
   * https://app.shortcut.com/laguna-health/story/5129/remove-deprecations-from-the-api
   * https://app.shortcut.com/laguna-health/story/5216/migration-analytics-of-existing-data
   */
  @Field(() => String, { nullable: true, deprecationReason })
  @Matches(onlyDateRegex, { message: Errors.get(ErrorType.memberDischargeDate) })
  @IsString() /* for rest api */
  @IsOptional()
  dischargeDate?: string;

  @Field(() => Honorific, { nullable: true })
  @IsEnum(Honorific) /* for rest api */
  @IsOptional()
  honorific?: Honorific;

  @Field(() => Race, { nullable: true })
  @IsEnum(Race) /* for rest api */
  @IsOptional()
  race?: Race;

  @Field(() => String, { nullable: true })
  @IsString() /* for rest api */
  @IsOptional()
  healthPlan?: string;

  @Field(() => String, { nullable: true })
  @IsString() /* for rest api */
  @IsOptional()
  preferredGenderPronoun?: string;

  @Field(() => MaritalStatus, { nullable: true })
  @IsEnum(MaritalStatus) /* for rest api */
  @IsOptional()
  maritalStatus?: MaritalStatus;

  @Field(() => Number, { nullable: true })
  @IsNumber() /* for rest api */
  @IsOptional()
  @Min(graphql.validators.height.min, { message: Errors.get(ErrorType.memberHeightNotInRange) })
  @Max(graphql.validators.height.max, { message: Errors.get(ErrorType.memberHeightNotInRange) })
  height?: number;

  @Field(() => Number, { nullable: true })
  @IsNumber() /* for rest api */
  @IsOptional()
  @Min(graphql.validators.weight.min, { message: Errors.get(ErrorType.memberWeightNotInRange) })
  @Max(graphql.validators.weight.max, { message: Errors.get(ErrorType.memberWeightNotInRange) })
  weight?: number;
}

@InputType()
export class CreateMemberParams extends ExtraMemberParams {
  @Field(() => String, { description: validPhoneExamples })
  @ValidateIf((params) => params.phone !== twilio.iosExcludeRegistrationNumber)
  @IsPhoneNumber(undefined, { message: Errors.get(ErrorType.memberPhone) })
  @IsNotEmpty() /* for rest api */
  @IsString() /* for rest api */
  phone: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString() /* for rest api */
  authId?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsObjectId({ message: Errors.get(ErrorType.userIdInvalid) })
  userId?: string;

  @Field(() => String)
  @Length(minLength, maxLength, { message: Errors.get(ErrorType.memberMinMaxLength) })
  @IsNotEmpty() /* for rest api */
  @IsString() /* for rest api */
  firstName: string;

  @Field(() => String)
  @Length(minLength, maxLength, { message: Errors.get(ErrorType.memberMinMaxLength) })
  @IsNotEmpty() /* for rest api */
  @IsString() /* for rest api */
  lastName: string;

  @Field(() => String)
  @Matches(onlyDateRegex, { message: Errors.get(ErrorType.memberDateOfBirth) })
  @IsNotEmpty() /* for rest api */
  @IsString() /* for rest api */
  dateOfBirth: string;

  @Field(() => String)
  @IsNotEmpty() /* for rest api */
  @IsString() /* for rest api */
  @IsObjectId({ message: Errors.get(ErrorType.memberOrgIdInvalid) })
  orgId: string;

  // language is not a part of the member object, but only used here for the first registration
  @Field(() => Language, { nullable: true })
  @IsEnum(Language) /* for rest api */
  @IsOptional()
  language?: Language;
}

export class InternalCreateMemberParams extends CreateMemberParams {
  phoneType: PhoneType;
}

@InputType()
export class UpdateMemberParams extends ExtraMemberParams {
  @Field(() => String)
  id: string;

  @Field({ nullable: true })
  @IsOptional()
  authId?: string;

  @Field(() => String, { nullable: true })
  @Length(minLength, maxLength, { message: Errors.get(ErrorType.memberMinMaxLength) })
  @IsOptional()
  firstName?: string;

  @Field(() => String, { nullable: true })
  @Length(minLength, maxLength, { message: Errors.get(ErrorType.memberMinMaxLength) })
  @IsOptional()
  lastName?: string;

  /**
   * will be @deprecated soon
   * use journey.dto.ts instead
   * https://app.shortcut.com/laguna-health/story/5129/remove-deprecations-from-the-api
   * https://app.shortcut.com/laguna-health/story/5216/migration-analytics-of-existing-data
   */
  @Field(() => String, { nullable: true, deprecationReason })
  @IsOptional()
  fellowName?: string;

  /**
   * will be @deprecated soon
   * use journey.dto.ts instead
   * https://app.shortcut.com/laguna-health/story/5129/remove-deprecations-from-the-api
   * https://app.shortcut.com/laguna-health/story/5216/migration-analytics-of-existing-data
   */
  @Field(() => String, { nullable: true, deprecationReason })
  @IsOptional()
  drg?: string;

  /**
   * will be @deprecated soon
   * use journey.dto.ts instead
   * https://app.shortcut.com/laguna-health/story/5129/remove-deprecations-from-the-api
   * https://app.shortcut.com/laguna-health/story/5216/migration-analytics-of-existing-data
   */
  @Field(() => String, { nullable: true, deprecationReason })
  @IsOptional()
  drgDesc?: string;

  /**
   * will be @deprecated soon
   * use admission.dto.ts instead
   * https://app.shortcut.com/laguna-health/story/5129/remove-deprecations-from-the-api
   * https://app.shortcut.com/laguna-health/story/5216/migration-analytics-of-existing-data
   */
  @Field(() => ReadmissionRisk, { nullable: true, deprecationReason })
  @IsOptional()
  readmissionRisk?: ReadmissionRisk;

  @Field(() => String, { description: validPhoneExamples, nullable: true })
  @IsOptional()
  @IsPhoneNumber(undefined, {
    message: Errors.get(ErrorType.memberPhone),
  })
  phoneSecondary?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  phoneSecondaryType?: PhoneType;

  @Field(() => Address, { nullable: true })
  @IsOptional()
  address?: Address;

  /**
   * will be @deprecated soon
   * use admission.dto.ts instead
   * https://app.shortcut.com/laguna-health/story/5129/remove-deprecations-from-the-api
   * https://app.shortcut.com/laguna-health/story/5216/migration-analytics-of-existing-data
   */
  @Field(() => String, { nullable: true, deprecationReason })
  @Matches(onlyDateRegex, { message: Errors.get(ErrorType.memberAdmitDate) })
  @IsOptional()
  admitDate?: string;

  @Field(() => String, { nullable: true })
  @Matches(onlyDateRegex, { message: Errors.get(ErrorType.memberDateOfBirth) })
  @IsOptional()
  dateOfBirth?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  deviceId?: string;

  @Field(() => Deceased, { nullable: true })
  @IsOptional()
  @IsOnlyDate({ message: Errors.get(ErrorType.memberDeceasedDate) })
  @IsPastDate({ message: Errors.get(ErrorType.memberDeceasedDateInTheFuture) })
  deceased?: Deceased;
}

@InputType()
export class ReplaceUserForMemberParams {
  @Field(() => String)
  @IsObjectId({ message: Errors.get(ErrorType.memberIdInvalid) })
  memberId: string;

  @Field(() => String)
  @IsObjectId({ message: Errors.get(ErrorType.userIdInvalid) })
  userId: string;
}

@InputType()
export class ReplaceMemberOrgParams {
  @Field(() => String)
  @IsObjectId({ message: Errors.get(ErrorType.memberIdInvalid) })
  memberId: string;

  @Field(() => String)
  @IsObjectId({ message: Errors.get(ErrorType.orgIdInvalid) })
  orgId: string;
}

@InputType()
export class RecordingLinkParams {
  @Field(() => String)
  id: string;

  @Field(() => String)
  @IsObjectId({ message: Errors.get(ErrorType.memberIdInvalid) })
  memberId: string;
}

@InputType()
export class MultipartUploadRecordingLinkParams {
  @Field(() => String)
  id: string;

  @Field(() => String)
  @IsObjectId({ message: Errors.get(ErrorType.memberIdInvalid) })
  memberId: string;

  @Field(() => Number)
  partNumber: number;

  @Field(() => String, { nullable: true })
  uploadId?: string;
}

@InputType()
export class CompleteMultipartUploadParams {
  @Field(() => String)
  id: string;

  @Field(() => String)
  @IsObjectId({ message: Errors.get(ErrorType.memberIdInvalid) })
  memberId: string;

  @Field(() => String)
  uploadId: string;
}

@InputType()
export class DeleteDischargeDocumentParams {
  @Field(() => String)
  @IsObjectId({ message: Errors.get(ErrorType.memberIdInvalid) })
  memberId: string;

  @Field(() => DischargeDocumentType)
  dischargeDocumentType: DischargeDocumentType;
}

/************************************************************************************************
 ***************************************** Notifications ****************************************
 ************************************************************************************************/

@InputType()
export class NotificationMetadata {
  @Field(() => String, { nullable: true })
  peerId?: string;

  @Field(() => String, { nullable: true })
  content?: string;

  @Field(() => Date, { nullable: true })
  when?: Date;

  sendBirdChannelUrl?: string;

  @Field(() => String, { nullable: true })
  @IsObjectId({ message: Errors.get(ErrorType.appointmentIdInvalid) })
  appointmentId?: string;
}

@Schema({ versionKey: false, timestamps: true })
@InputType()
export class NotifyParams {
  @Prop()
  @Field(() => String)
  @IsObjectId({ message: Errors.get(ErrorType.memberIdInvalid) })
  memberId: string;

  @Prop()
  @Field(() => String)
  @IsObjectId({ message: Errors.get(ErrorType.userIdInvalid) })
  userId: string;

  @Prop({ type: String, enum: NotificationType })
  @IsNotChat({ message: Errors.get(ErrorType.notificationChatNotSupported) })
  @IsTypeMetadataProvided({ message: Errors.get(ErrorType.notificationMetadataInvalid) })
  @Field(() => NotificationType)
  type: NotificationType;

  @Prop()
  @Field(() => NotificationMetadata)
  metadata: NotificationMetadata;
}

@InputType()
export class NotifyContentMetadata {
  @Field(() => String, { nullable: true })
  @IsObjectId({ message: Errors.get(ErrorType.questionnaireIdInvalid) })
  questionnaireId?: string;
}

@InputType()
export class NotifyContentParams {
  @Field(() => String)
  @IsObjectId({ message: Errors.get(ErrorType.memberIdInvalid) })
  memberId: string;

  @Field(() => String)
  @IsObjectId({ message: Errors.get(ErrorType.userIdInvalid) })
  userId: string;

  @Field(() => ExternalKey)
  @IsContentMetadataProvided({ message: Errors.get(ErrorType.notifyContentMetadataInvalid) })
  contentKey: ExternalKey;

  @Field(() => NotifyContentMetadata, { nullable: true })
  metadata?: NotifyContentMetadata;
}

@InputType()
export class CancelNotificationMetadata {
  @Field(() => String, { nullable: true })
  peerId?: string;
}

@InputType()
export class CancelNotifyParams {
  @Field(() => String)
  @IsObjectId({ message: Errors.get(ErrorType.memberIdInvalid) })
  memberId: string;

  @IsTypeMetadataProvided({ message: Errors.get(ErrorType.notificationMetadataInvalid) })
  @Field(() => CancelNotificationType)
  type: CancelNotificationType;

  @Field(() => CancelNotificationMetadata)
  metadata: CancelNotificationMetadata;
}

@InputType()
export class DeleteMemberParams {
  @Field(() => String)
  @IsObjectId({ message: Errors.get(ErrorType.memberIdInvalid) })
  id: string;

  @Field(() => Boolean, { defaultValue: false })
  hard?: boolean;
}

@InputType()
export class BaseMemberGeneralDocuments {
  @Field(() => String)
  @IsObjectId({ message: Errors.get(ErrorType.memberIdInvalid) })
  memberId: string;

  @Field(() => String)
  fileName: string;
}

@InputType()
export class GetMemberUploadGeneralDocumentLinkParams extends BaseMemberGeneralDocuments {}

@InputType()
export class DeleteMemberGeneralDocumentParams extends BaseMemberGeneralDocuments {}

/**************************************************************************************************
 ********************************* Return params for gql methods **********************************
 *************************************************************************************************/

@ObjectType()
@Schema({ versionKey: false, timestamps: true })
export class Member extends Identifier {
  @Prop({ isNaN: true })
  @Field(() => String, { nullable: true })
  authId?: string;

  @Prop({ default: defaultMemberParams.roles })
  @Field(() => [MemberRole], {
    description: 'role of the member: currently only `member`',
  })
  roles: MemberRole[];

  @Prop({ unique: true, index: true })
  @Field(() => String)
  phone: string;

  @Prop({ type: String })
  @Field(() => String, { nullable: true })
  phoneType: PhoneType;

  @Prop({ index: true, isNaN: true })
  @Field(() => String, { nullable: true })
  deviceId: string;

  @Prop()
  @Field(() => String)
  firstName: string;

  @Prop()
  @Field(() => String)
  lastName: string;

  @Prop()
  @Field(() => String)
  dateOfBirth: string;

  @Prop({ type: Types.ObjectId, ref: Org.name, index: true })
  @Field(() => Org)
  org: Org;

  @Prop({ type: Types.ObjectId, index: true })
  @Field(() => String, { description: 'primary user id' })
  primaryUserId: Types.ObjectId;

  @Prop({ type: [{ type: Types.ObjectId, ref: User.name }] })
  @Field(() => [User], { description: 'users reference object' })
  users: User[];

  @Prop({ type: String, enum: Sex, default: defaultMemberParams.sex })
  @Field(() => Sex)
  sex: Sex;

  @Prop({ isNaN: true })
  @Field(() => String, { nullable: true })
  email?: string;

  @Prop({ isNaN: true })
  @Field(() => String, { nullable: true })
  zipCode?: string;

  @Prop({ isNaN: true })
  @Field(() => String, { nullable: true })
  dischargeDate?: string;

  /**
   * will be @deprecated soon
   * use journey.dto.ts instead
   * https://app.shortcut.com/laguna-health/story/5129/remove-deprecations-from-the-api
   * https://app.shortcut.com/laguna-health/story/5216/migration-analytics-of-existing-data
   */
  @Prop({ type: [{ type: Types.ObjectId, ref: ActionItem.name }], isNaN: true })
  @Field(() => [ActionItem], { nullable: true, deprecationReason })
  actionItems?: ActionItem[];

  @Prop({ isNaN: true })
  @Field(() => Scores, { nullable: true })
  scores?: Scores;

  /**
   * will be @deprecated soon
   * use journey.dto.ts instead
   * https://app.shortcut.com/laguna-health/story/5129/remove-deprecations-from-the-api
   * https://app.shortcut.com/laguna-health/story/5216/migration-analytics-of-existing-data
   */
  @Prop({ isNaN: true })
  @Field(() => String, { nullable: true, deprecationReason })
  @IsOptional()
  fellowName?: string;

  @Prop({ isNaN: true })
  @Field(() => String, { nullable: true })
  @IsOptional()
  drg?: string;

  @Prop({ isNaN: true })
  @Field(() => String, { nullable: true })
  @IsOptional()
  drgDesc?: string;

  @Prop({ isNaN: true })
  @Field({ description: validPhoneExamples, nullable: true })
  @IsPhoneNumber(undefined, {
    message: Errors.get(ErrorType.memberPhone),
  })
  phoneSecondary?: string;

  @Prop({ type: String, isNaN: true })
  @Field(() => String, { nullable: true })
  phoneSecondaryType?: PhoneType;

  @Prop()
  @Field(() => Date)
  createdAt: Date;

  @Prop()
  updatedAt: Date;

  @Field(() => Number, { nullable: true })
  utcDelta?: number;

  @Prop({ isNaN: true })
  @Field(() => Address, { nullable: true })
  address?: Address;

  /**
   * will be @deprecated soon
   * use admission.dto.ts instead
   * https://app.shortcut.com/laguna-health/story/5129/remove-deprecations-from-the-api
   * https://app.shortcut.com/laguna-health/story/5216/migration-analytics-of-existing-data
   */
  @Prop({ isNaN: true })
  @Field(() => String, { nullable: true, deprecationReason })
  generalNotes?: string;

  /**
   * will be @deprecated soon
   * use admission.dto.ts instead
   * https://app.shortcut.com/laguna-health/story/5129/remove-deprecations-from-the-api
   * https://app.shortcut.com/laguna-health/story/5216/migration-analytics-of-existing-data
   */
  @Prop({ isNaN: true })
  @Field(() => String, { nullable: true, deprecationReason })
  nurseNotes?: string;

  @Prop({ isNaN: true })
  @Field(() => String, { nullable: true })
  admitDate?: string;

  @Prop({ type: String, enum: Honorific, default: defaultMemberParams.honorific })
  @Field(() => Honorific)
  honorific: Honorific;

  @Prop({ type: String, enum: Race, isNaN: true })
  @Field(() => Race, { nullable: true })
  race?: Race;

  /**
   * will be @deprecated soon
   * use admission.dto.ts instead
   * https://app.shortcut.com/laguna-health/story/5129/remove-deprecations-from-the-api
   * https://app.shortcut.com/laguna-health/story/5216/migration-analytics-of-existing-data
   */
  @Prop({ type: String, enum: ReadmissionRisk, isNaN: true })
  @Field(() => ReadmissionRisk, { nullable: true, deprecationReason })
  readmissionRisk?: ReadmissionRisk;

  /**
   * will be @deprecated soon
   * use admission.dto.ts instead
   * https://app.shortcut.com/laguna-health/story/5129/remove-deprecations-from-the-api
   * https://app.shortcut.com/laguna-health/story/5216/migration-analytics-of-existing-data
   */
  @Prop({ isNaN: true })
  @Field(() => [ReadmissionRiskHistory], { nullable: true, deprecationReason })
  readmissionRiskHistory?: ReadmissionRiskHistory[];

  @Prop({ isNaN: true })
  @Field(() => String, { nullable: true })
  healthPlan?: string;

  @Prop({ isNaN: true })
  @Field(() => String, { nullable: true })
  preferredGenderPronoun?: string;

  @Prop({ type: String, enum: HealthPersona, isNaN: true })
  @Field(() => HealthPersona, { nullable: true })
  healthPersona?: HealthPersona;

  @Prop({ type: String, enum: MaritalStatus, isNaN: true })
  @Field(() => MaritalStatus, { nullable: true })
  maritalStatus?: MaritalStatus;

  @Prop({ type: Number, isNaN: true })
  @Field(() => Number, { nullable: true })
  height?: number;

  @Prop({ type: Number, isNaN: true })
  @Field(() => Number, { nullable: true })
  weight?: number;

  @Prop({ type: Deceased, isNaN: true })
  @Field(() => Deceased, { nullable: true })
  deceased?: Deceased;
}

@ObjectType()
export class MemberSummary extends Identifier {
  @Field(() => String)
  name: string;

  @Field(() => String)
  phone: string;

  @Field(() => String, { nullable: true })
  phoneType: PhoneType;

  @Field(() => String, { nullable: true })
  dischargeDate?: string;

  @Field(() => Number)
  adherence: number;

  @Field(() => Number)
  wellbeing: number;

  @Field(() => Date)
  createdAt: Date;

  @Field(() => Number)
  actionItemsCount: number;

  @Field(() => User)
  primaryUser: User;

  @Field(() => Date, { nullable: true })
  nextAppointment?: Date;

  @Field(() => Number)
  appointmentsCount: number;

  @Field(() => Org)
  org: Org;

  @Field(() => Date, { nullable: true })
  firstLoggedInAt?: Date;

  @Field(() => String)
  platform: string;

  @Field(() => Boolean)
  isGraduated: boolean;

  @Field(() => Date, { nullable: true })
  graduationDate?: Date;
}

@ObjectType()
export class AppointmentCompose {
  @Field(() => String)
  memberId: string;

  @Field(() => String)
  memberName: string;

  @Field(() => String)
  userId: string;

  @Field(() => String)
  userName: string;

  @Field(() => Date)
  start: Date;

  @Field(() => Date)
  end: Date;

  @Field(() => AppointmentStatus)
  status: AppointmentStatus;
}

@ObjectType()
export class DischargeDocumentsLinks {
  @Field(() => String, { nullable: true })
  dischargeNotesLink?: string;

  @Field(() => String, { nullable: true })
  dischargeInstructionsLink?: string;
}

@ObjectType()
export class MultipartUploadInfo {
  @Field(() => String)
  url: string;

  @Field(() => String)
  uploadId: string;
}

/**************************************************************************************************
 ********************************************* Control ********************************************
 *************************************************************************************************/

@Schema({ versionKey: false, timestamps: true })
export class ControlMember extends Member {}

/**************************************************************************************************
 **************************************** Exported Schemas ****************************************
 *************************************************************************************************/
export type MemberDocument = Member & Document & ISoftDelete<Member>;
export const MemberDto = audit(
  SchemaFactory.createForClass(Member).plugin(mongooseDelete, useFactoryOptions),
);
export type ControlMemberDocument = ControlMember & Document;
export const ControlMemberDto = audit(SchemaFactory.createForClass(ControlMember));
