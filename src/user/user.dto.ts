import { Field, InputType, ObjectType, registerEnumType } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { IsEmail, IsOptional, IsPhoneNumber, IsUrl, Length } from 'class-validator';
import * as config from 'config';
import { Document, Types } from 'mongoose';
import { UserRole } from '../common';
import { Appointment, AppointmentData } from '../appointment';
import { ErrorType, Errors, Identifier, validPhoneExamples } from '../common';
import { Language } from '@lagunahealth/pandora';

registerEnumType(UserRole, { name: 'UserRole' });

const validatorsConfig = config.get('graphql.validators');

export const defaultUserParams = {
  maxCustomers: 7,
  languages: [Language.en],
  roles: [UserRole.coach],
  avatar: 'https://i.imgur.com/bvuKGXB.png',
};

export const NotNullableUserKeys = ['maxCustomers', 'languages', 'roles', 'avatar'];

/**************************************************************************************************
 ********************************** Input params for gql methods **********************************
 *************************************************************************************************/
@InputType()
export class CreateUserParams {
  @Field()
  authId: string;

  @Field()
  @Length(validatorsConfig.get('name.minLength'), validatorsConfig.get('name.maxLength'), {
    message: Errors.get(ErrorType.userMinMaxLength),
  })
  firstName: string;

  @Field()
  @Length(validatorsConfig.get('name.minLength'), validatorsConfig.get('name.maxLength'), {
    message: Errors.get(ErrorType.userMinMaxLength),
  })
  lastName: string;

  @Field()
  @IsEmail(undefined, { message: Errors.get(ErrorType.userEmailFormat) })
  email: string;

  @Field(() => [UserRole], { nullable: true })
  roles?: UserRole[];

  @Field({ nullable: true })
  @IsOptional()
  @IsUrl(undefined, { message: Errors.get(ErrorType.userAvatarFormat) })
  avatar?: string;

  @Field({ nullable: true })
  description?: string;

  @Field({ description: validPhoneExamples })
  @IsPhoneNumber(undefined, { message: Errors.get(ErrorType.userPhone) })
  phone: string;

  @Field({ nullable: true })
  title?: string;

  @Field(() => Number, { nullable: true })
  maxCustomers?: number;

  @Field(() => [Language], { nullable: true })
  languages?: Language[];
}

/**************************************************************************************************
 ********************************* Return params for gql methods **********************************
 *************************************************************************************************/
@ObjectType()
@Schema({ versionKey: false, timestamps: true })
export class User extends Identifier {
  @Prop()
  @Field(() => String)
  authId: string;

  @Prop()
  @Field(() => String)
  firstName: string;

  @Prop()
  @Field(() => String)
  lastName: string;

  @Prop({ unique: true })
  @Field(() => String)
  email: string;

  @Prop({ default: defaultUserParams.roles })
  @Field(() => [UserRole], {
    description: 'role of the user: admin/user/nurse/nutrition/doctor/...',
  })
  roles: UserRole[];

  @Prop({ default: defaultUserParams.avatar })
  @Field(() => String, { nullable: true })
  avatar?: string;

  @Prop({ type: [{ type: Types.ObjectId, ref: Appointment.name }] })
  @Field(() => [AppointmentData], { nullable: true })
  appointments?: AppointmentData[];

  @Prop({ isNaN: true })
  @Field(() => String, { nullable: true })
  description?: string;

  @Field(() => Date)
  createdAt: Date;

  @Prop()
  @Field(() => String)
  phone: string;

  @Prop({ isNaN: true })
  @Field({ nullable: true })
  title?: string;

  @Prop({ default: defaultUserParams.maxCustomers })
  @Field(() => Number)
  maxCustomers?: number;

  @Prop({ default: defaultUserParams.languages })
  @Field(() => [Language], { nullable: true })
  languages?: Language[];

  /**
   * we use that start of time (new Date(0)) for the default time for
   * lastMemberAssignedAt so a new user will get the next new member.
   */
  @Prop()
  lastMemberAssignedAt: Date;
}

/**************************************************************************************************
 **************************************** Exported Schemas ****************************************
 *************************************************************************************************/
export type UserDocument = User & Document;
export const UserDto = SchemaFactory.createForClass(User);
