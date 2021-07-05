import {
  Field,
  ObjectType,
  InputType,
  registerEnumType,
} from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import * as mongoose from 'mongoose';
import { Identifier } from '../common';
import { IsEmail, IsOptional, IsUrl, Length } from 'class-validator';
import * as config from 'config';

export enum UserRole {
  admin = 'Admin',
  coach = 'Coach',
  nurse = 'Nurse',
}
registerEnumType(UserRole, { name: 'UserRole' });

const validatorsConfig = config.get('graphql.validators');
/***********************************************************************************************************************
 ******************************************** Input params for gql methods *********************************************
 **********************************************************************************************************************/
@InputType()
export class CreateUserParams {
  @Field()
  @Length(
    validatorsConfig.get('name.minLength'),
    validatorsConfig.get('name.maxLength'),
  )
  name: string;

  @Field()
  @IsEmail()
  email: string;

  @Field(() => [UserRole])
  roles: UserRole[];

  @Field()
  @IsUrl()
  photoUrl: string;
}

/***********************************************************************************************************************
 ******************************************** Return params for gql methods ********************************************
 **********************************************************************************************************************/
@ObjectType()
@Schema({ versionKey: false, timestamps: true })
export class User extends Identifier {
  @Prop()
  @Field(() => String, { description: 'name' })
  name: string;

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
  photoUrl: string;
}

/***********************************************************************************************************************
 ************************************************** Exported Schemas ***************************************************
 **********************************************************************************************************************/
export type UserDocument = User & mongoose.Document;
export const UserDto = SchemaFactory.createForClass(User);
