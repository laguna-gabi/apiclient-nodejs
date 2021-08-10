import { Field, InputType, ObjectType, registerEnumType } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from '../user';
import {
  Errors,
  ErrorType,
  Identifier,
  IsPrimaryUserInUsers,
  Language,
  validPhoneExamples,
} from '../common';
import { IsDate, IsEmail, IsOptional, IsPhoneNumber, Length } from 'class-validator';
import * as config from 'config';
import { Org } from '../org';
import { ActionItem, Goal } from '.';
import { Scores } from '../appointment';

const validatorsConfig = config.get('graphql.validators');

/**************************************************************************************************
 ******************************* Enum registration for gql methods ********************************
 *************************************************************************************************/
export enum Sex {
  male = 'male',
  female = 'female',
  other = 'other',
}

registerEnumType(Sex, { name: 'Sex' });

export const defaultMemberParams = {
  sex: Sex.male,
  language: Language.en,
};

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
  @IsOptional()
  sex?: Sex;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsEmail(undefined, {
    message: Errors.get(ErrorType.memberEmailFormat),
  })
  email?: string;

  @Field(() => Language, { nullable: true })
  @IsOptional()
  language?: Language;

  @Field(() => String, { nullable: true })
  @IsOptional()
  zipCode?: string;

  @Field(() => Date, { nullable: true })
  @IsOptional()
  @IsDate({ message: Errors.get(ErrorType.memberDischargeDate) })
  dischargeDate?: Date;
}

@InputType()
export class CreateMemberParams extends ExtraMemberParams {
  @Field({ description: validPhoneExamples })
  @IsPhoneNumber(undefined, {
    message: Errors.get(ErrorType.memberPhone),
  })
  phone: string;

  @Field(() => String)
  deviceId: string;

  @Field()
  @Length(validatorsConfig.get('name.minLength'), validatorsConfig.get('name.maxLength'), {
    message: Errors.get(ErrorType.memberMinMaxLength),
  })
  firstName: string;

  @Field()
  @Length(validatorsConfig.get('name.minLength'), validatorsConfig.get('name.maxLength'), {
    message: Errors.get(ErrorType.memberMinMaxLength),
  })
  lastName: string;

  @Field(() => Date)
  @IsDate({ message: Errors.get(ErrorType.memberDateOfBirth) })
  dateOfBirth: Date;

  @Field(() => String)
  orgId: string;

  @Field(() => String)
  primaryUserId: string;

  @Field(() => [String])
  @IsPrimaryUserInUsers({ message: Errors.get(ErrorType.memberPrimaryUserIdNotInUsers) })
  usersIds: string[];
}

@InputType()
export class UpdateMemberParams extends ExtraMemberParams {
  @Field(() => String)
  id: string;

  @Field({ nullable: true })
  @Length(validatorsConfig.get('name.minLength'), validatorsConfig.get('name.maxLength'), {
    message: Errors.get(ErrorType.memberMinMaxLength),
  })
  firstName?: string;

  @Field({ nullable: true })
  @Length(validatorsConfig.get('name.minLength'), validatorsConfig.get('name.maxLength'), {
    message: Errors.get(ErrorType.memberMinMaxLength),
  })
  lastName?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  fellowName?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  drgDesc?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  readmissionRisk?: string;

  @Field({ description: validPhoneExamples, nullable: true })
  @IsOptional()
  @IsPhoneNumber(undefined, {
    message: Errors.get(ErrorType.memberPhone),
  })
  phoneSecondary?: string;

  @Field(() => Address, { nullable: true })
  @IsOptional()
  address?: Address;

  @Field(() => Date, { nullable: true })
  @IsDate({ message: Errors.get(ErrorType.memberAdminDate) })
  admitDate?: Date;
}

@InputType()
export class SetGeneralNotesParams {
  @Field(() => String)
  memberId: string;

  @Field(() => String, { nullable: true })
  note?: string;
}

/**************************************************************************************************
 ********************************* Return params for gql methods **********************************
 *************************************************************************************************/
@ObjectType()
@Schema({ versionKey: false, timestamps: true })
export class Member extends Identifier {
  @Prop({ unique: true, index: true })
  @Field(() => String)
  phone: string;

  @Prop({ index: true })
  @Field(() => String)
  deviceId: string;

  @Prop()
  @Field(() => String)
  firstName: string;

  @Prop()
  @Field(() => String)
  lastName: string;

  @Prop({ type: Date })
  @Field(() => Date)
  dateOfBirth: Date;

  @Prop({ type: Types.ObjectId, ref: Org.name, index: true })
  @Field(() => Org)
  org: Org;

  @Prop(() => Types.ObjectId)
  @Field(() => String, { description: 'primary user id' })
  primaryUserId: string;

  @Prop({ type: [{ type: Types.ObjectId, ref: User.name }] })
  @Field(() => [User], { description: 'users reference object' })
  users: User[];

  @Prop()
  @Field(() => String)
  dischargeNotesLink: string;

  @Prop()
  @Field(() => String)
  dischargeInstructionsLink: string;

  @Prop({ default: defaultMemberParams.sex })
  @Field(() => Sex)
  sex: Sex;

  @Prop({ isNaN: true })
  @Field(() => String, { nullable: true })
  email?: string;

  @Prop({ default: defaultMemberParams.language })
  @Field(() => Language)
  language: Language;

  @Prop({ isNaN: true })
  @Field(() => String, { nullable: true })
  zipCode?: string;

  @Prop({ isNaN: true })
  @Field(() => Date, { nullable: true })
  dischargeDate?: Date;

  @Prop({ type: [{ type: Types.ObjectId, ref: Goal.name }], isNaN: true })
  @Field(() => [Goal], { nullable: true })
  goals?: Goal[];

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
  drgDesc?: string;

  @Prop({ isNaN: true })
  @Field(() => String, { nullable: true })
  @IsOptional()
  readmissionRisk?: string;

  @Prop({ isNaN: true })
  @Field({ description: validPhoneExamples, nullable: true })
  @IsPhoneNumber(undefined, {
    message: Errors.get(ErrorType.memberPhone),
  })
  phoneSecondary?: string;

  @Prop()
  @Field(() => Date)
  createdAt: Date;

  @Field(() => Number, { nullable: true })
  utcDelta?: number;

  @Prop({ isNaN: true })
  @Field(() => Address, { nullable: true })
  address?: Address;

  @Prop({ isNaN: true })
  @Field(() => String, { nullable: true })
  generalNotes?: string;

  @Prop({ isNaN: true })
  @Field(() => Date, { nullable: true })
  admitDate?: Date;
}

@ObjectType()
export class MemberSummary extends Identifier {
  @Field(() => String)
  name: string;

  @Field(() => String)
  phone: string;

  @Field(() => Date, { nullable: true })
  dischargeDate?: Date;

  @Field(() => Number)
  adherence: number;

  @Field(() => Number)
  wellbeing: number;

  @Field(() => Date)
  createdAt: Date;

  @Field(() => Number)
  goalsCount: number;

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

/**************************************************************************************************
 **************************************** Exported Schemas ****************************************
 *************************************************************************************************/
export type MemberDocument = Member & Document;
export const MemberDto = SchemaFactory.createForClass(Member);
