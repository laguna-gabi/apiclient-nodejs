import {
  CancelNotificationType,
  ExternalKey,
  Honorific,
  Language,
  NotificationType,
} from '@argus/pandora';
import { Field, InputType, ObjectType, registerEnumType } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsPhoneNumber,
  IsString,
  Length,
  ValidateIf,
} from 'class-validator';
import { twilio } from 'config';
import { Document, Types } from 'mongoose';
import { ActionItem } from '.';
import { Scores } from '../appointment';
import {
  ErrorType,
  Errors,
  Identifier,
  IsContentMetadataProvided,
  IsNotChat,
  IsNoteOrNurseNoteProvided,
  IsObjectId,
  IsStringDate,
  IsTypeMetadataProvided,
  IsValidZipCode,
  MemberRole,
  PhoneType,
  maxLength,
  minLength,
  validPhoneExamples,
} from '../common';
import { Org } from '../org';
import { HealthPersona } from '../questionnaire';
import { User } from '../user';
import { ISoftDelete, audit, useFactoryOptions } from '../db';
import * as mongooseDelete from 'mongoose-delete';

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

registerEnumType(Honorific, { name: 'Honorific' });

export enum Race { // TBD: get requirements from product
  white = 'white',
  black = 'black',
  asian = 'asian',
  indian = 'indian',
  hawaiian = 'hawaiian',
}

registerEnumType(Race, { name: 'Race' });

export enum Ethnicity { // TBD: get requirements from product
  latino = 'latino',
  hispanic = 'hispanic',
  other = 'other',
}

registerEnumType(Ethnicity, { name: 'Ethnicity' });

export enum ReadmissionRisk {
  high = 'high',
  medium = 'medium',
  low = 'low',
}

registerEnumType(ReadmissionRisk, { name: 'ReadmissionRisk' });

export enum DischargeDocumentType {
  Summary = 'Summary',
  Instructions = 'Instructions',
}

registerEnumType(DischargeDocumentType, { name: 'DischargeDocumentType' });

export const defaultMemberParams = {
  sex: Sex.male,
  language: Language.en,
  honorific: Honorific.mx,
  roles: [MemberRole.member],
  ethnicity: Ethnicity.latino,
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

export const EmbeddedMemberProperties = ['address'];

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

  @Field(() => String, { nullable: true })
  @IsStringDate({ message: Errors.get(ErrorType.memberDischargeDate) })
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

  @Field(() => Ethnicity, { nullable: true })
  @IsEnum(Ethnicity) /* for rest api */
  @IsOptional()
  ethnicity?: Ethnicity;

  @Field(() => String, { nullable: true })
  @IsString() /* for rest api */
  @IsOptional()
  healthPlan?: string;

  @Field(() => String, { nullable: true })
  @IsString() /* for rest api */
  @IsOptional()
  preferredGenderPronoun?: string;
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
  @IsStringDate({ message: Errors.get(ErrorType.memberDateOfBirth) })
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

  @Field(() => String, { nullable: true })
  @IsOptional()
  fellowName?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  drg?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  drgDesc?: string;

  @Field(() => ReadmissionRisk, { nullable: true })
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

  @Field(() => String, { nullable: true })
  @IsStringDate({ message: Errors.get(ErrorType.memberAdmitDate) })
  @IsOptional()
  admitDate?: string;

  @Field(() => String, { nullable: true })
  @IsStringDate({ message: Errors.get(ErrorType.memberDateOfBirth) })
  @IsOptional()
  dateOfBirth?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  deviceId?: string;
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
export class SetGeneralNotesParams {
  @Field(() => String)
  @IsObjectId({ message: Errors.get(ErrorType.memberIdInvalid) })
  memberId: string;

  @Field(() => String, { nullable: true })
  note?: string;

  @Field(() => String, { nullable: true })
  @IsNoteOrNurseNoteProvided({ message: Errors.get(ErrorType.memberNotesAndNurseNotesNotProvided) })
  nurseNotes?: string;
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

  @Prop({ type: [{ type: Types.ObjectId, ref: ActionItem.name }], isNaN: true })
  @Field(() => [ActionItem], { nullable: true })
  actionItems?: ActionItem[];

  @Prop({ isNaN: true })
  @Field(() => Scores, { nullable: true })
  scores?: Scores;

  @Prop({ isNaN: true })
  @Field(() => String, { nullable: true })
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

  @Prop({ isNaN: true })
  @Field(() => String, { nullable: true })
  generalNotes?: string;

  @Prop({ isNaN: true })
  @Field(() => String, { nullable: true })
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

  @Prop({ type: String, enum: Ethnicity, isNaN: true })
  @Field(() => Ethnicity, { nullable: true })
  ethnicity?: Ethnicity;

  @Prop({ isNaN: true })
  @Field(() => ReadmissionRisk, { nullable: true })
  readmissionRisk?: ReadmissionRisk;

  @Prop({ type: String, enum: ReadmissionRisk, isNaN: true })
  @Field(() => [ReadmissionRiskHistory], { nullable: true })
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

@ObjectType()
export class ReadmissionRiskHistory {
  @Field(() => ReadmissionRisk, { nullable: true })
  readmissionRisk?: ReadmissionRisk;

  @Field(() => Date)
  date: Date;
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
