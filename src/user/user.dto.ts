import { Field, InputType, ObjectType, registerEnumType } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Errors, ErrorType, Identifier, Language, validPhoneExamples } from '../common';
import { IsEmail, IsPhoneNumber, IsUrl, Length } from 'class-validator';
import * as config from 'config';
import { Appointment, AppointmentData } from '../appointment';

export enum UserRole {
  admin = 'Admin',
  coach = 'Coach',
  nurse = 'Nurse',
}

registerEnumType(UserRole, { name: 'UserRole' });

const validatorsConfig = config.get('graphql.validators');

export const defaultUserParams = {
  maxCustomers: 7,
  languages: [Language.en],
};

export const NotNullableUserKeys = ['maxCustomers'];

/**************************************************************************************************
 ********************************** Input params for gql methods **********************************
 *************************************************************************************************/
@InputType()
export class CreateUserParams {
  @Field()
  id: string;

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
  @IsEmail(undefined, {
    message: Errors.get(ErrorType.userEmailFormat),
  })
  email: string;

  @Field(() => [UserRole])
  roles: UserRole[];

  @Field()
  @IsUrl(undefined, { message: Errors.get(ErrorType.userAvatarFormat) })
  avatar: string;

  @Field()
  description: string;

  @Field({ description: validPhoneExamples })
  @IsPhoneNumber(undefined, {
    message: Errors.get(ErrorType.userPhone),
  })
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
  @Prop(() => String)
  _id: string;

  @Prop()
  @Field(() => String)
  firstName: string;

  @Prop()
  @Field(() => String)
  lastName: string;

  @Prop({ unique: true })
  @Field(() => String)
  email: string;

  @Prop()
  @Field(() => [UserRole], {
    description: 'role of the user: admin/user/nurse/nutrition/doctor/...',
  })
  roles: UserRole[];

  @Prop()
  @Field(() => String)
  avatar: string;

  @Prop({ type: [{ type: Types.ObjectId, ref: Appointment.name }] })
  @Field(() => [AppointmentData], { nullable: true })
  appointments?: AppointmentData[];

  @Prop()
  @Field(() => String)
  description: string;

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
}

/**************************************************************************************************
 **************************************** Exported Schemas ****************************************
 *************************************************************************************************/
export type UserDocument = User & Document;
export const UserDto = SchemaFactory.createForClass(User);
