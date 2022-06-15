import { User, UserRole } from '@argus/hepiusClient';
import { Language } from '@argus/pandora';
import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { SchemaFactory } from '@nestjs/mongoose';
import { IsEmail, IsOptional, IsPhoneNumber, IsUrl, Length } from 'class-validator';
import { Document } from 'mongoose';
import {
  ErrorType,
  Errors,
  IsObjectIds,
  maxLength,
  minLength,
  validPhoneExamples,
} from '../common';
import { audit } from '../db';

export const NotNullableUserKeys = ['maxMembers', 'languages', 'roles', 'avatar'];

/**************************************************************************************************
 ********************************** Input params for gql methods **********************************
 *************************************************************************************************/
@InputType()
class ExtraUserParams {
  @Field(() => [UserRole], { nullable: true })
  roles?: UserRole[];

  @Field({ nullable: true })
  @IsOptional()
  @IsUrl(undefined, { message: Errors.get(ErrorType.userAvatarFormat) })
  avatar?: string;

  @Field({ nullable: true })
  description?: string;

  @Field({ nullable: true })
  title?: string;

  @Field(() => Number, { nullable: true })
  maxMembers?: number;

  @Field(() => [Language], { nullable: true })
  languages?: Language[];
}

@InputType()
export class CreateUserParams extends ExtraUserParams {
  @Field()
  @Length(minLength, maxLength, { message: Errors.get(ErrorType.userMinMaxLength) })
  firstName: string;

  @Field()
  @Length(minLength, maxLength, { message: Errors.get(ErrorType.userMinMaxLength) })
  lastName: string;

  @Field()
  @IsEmail(undefined, { message: Errors.get(ErrorType.userEmailFormat) })
  email: string;

  @Field({ description: validPhoneExamples })
  @IsPhoneNumber(undefined, { message: Errors.get(ErrorType.userPhone) })
  phone: string;

  @Field(() => [String])
  @IsObjectIds({ message: Errors.get(ErrorType.journeyOrgIdInvalid) })
  orgs: string[];
}

@InputType()
export class UpdateUserParams extends ExtraUserParams {
  @Field(() => String)
  id: string;

  @Field({ nullable: true })
  @IsOptional()
  @Length(minLength, maxLength, { message: Errors.get(ErrorType.userMinMaxLength) })
  firstName?: string;

  @Field({ nullable: true })
  @IsOptional()
  @Length(minLength, maxLength, { message: Errors.get(ErrorType.userMinMaxLength) })
  lastName?: string;

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsObjectIds({ message: Errors.get(ErrorType.journeyOrgIdInvalid) })
  orgs?: string[];
}

@ObjectType()
export class UserSummary extends User {
  @Field(() => Number)
  currentMembersCount: number;

  @Field(() => Boolean)
  isEnabled: boolean;
}

/**************************************************************************************************
 **************************************** Exported Schemas ****************************************
 *************************************************************************************************/
export type UserDocument = User & Document;
export const UserDto = audit(SchemaFactory.createForClass(User));
