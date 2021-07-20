import { Field, InputType, ObjectType, registerEnumType } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Errors, ErrorType, Identifier } from '../common';
import { IsEmail, IsUrl, Length } from 'class-validator';
import * as config from 'config';
import { Appointment, AppointmentData } from '../appointment';

export enum UserRole {
  admin = 'Admin',
  coach = 'Coach',
  nurse = 'Nurse',
}

registerEnumType(UserRole, { name: 'UserRole' });

const validatorsConfig = config.get('graphql.validators');

/**************************************************************************************************
 ********************************** Input params for gql methods **********************************
 *************************************************************************************************/
@InputType()
export class CreateUserParams {
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
}

/**************************************************************************************************
 ********************************* Return params for gql methods **********************************
 *************************************************************************************************/
@ObjectType()
@Schema({ versionKey: false, timestamps: true })
export class User extends Identifier {
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
}

/**************************************************************************************************
 **************************************** Exported Schemas ****************************************
 *************************************************************************************************/
export type UserDocument = User & Document;
export const UserDto = SchemaFactory.createForClass(User);
