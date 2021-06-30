import {
  Field,
  ObjectType,
  InputType,
  registerEnumType,
} from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import * as mongoose from 'mongoose';
import { Identifier } from '../common';

export enum UserRole {
  admin = 'Admin',
  coach = 'Coach',
  nurse = 'Nurse',
}
registerEnumType(UserRole, { name: 'UserRole' });

/***********************************************************************************************************************
 ******************************************** Input params for gql methods *********************************************
 **********************************************************************************************************************/
@InputType()
export class CreateUserParams {
  @Field()
  name: string;

  @Field({ nullable: false })
  email: string;

  @Field(() => UserRole)
  role: UserRole;

  @Field()
  photoUrl?: string;
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
  @Field(() => UserRole, {
    description: 'role of the user: admin/user/nurse/nutrition/doctor/...',
  })
  role: UserRole;

  @Prop()
  @Field(() => String, {
    description: 'profile image, can be nullable',
    nullable: true,
  })
  photoUrl?: string;
}

/***********************************************************************************************************************
 ************************************************** Exported Schemas ***************************************************
 **********************************************************************************************************************/
export type UserDocument = User & mongoose.Document;
export const UserDto = SchemaFactory.createForClass(User);
