import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import * as mongoose from 'mongoose';
import { Document } from 'mongoose';
import { User } from '../user/user.dto';
import { Identifier } from '../common';
import { IsDate, IsPhoneNumber, Length } from 'class-validator';
import * as config from 'config';

const validatorsConfig = config.get('graphql.validators');

/***********************************************************************************************************************
 ******************************************** Input params for gql methods *********************************************
 **********************************************************************************************************************/
@InputType()
export class CreateMemberParams {
  @Field({
    description:
      `phone number is invalid. please make sure you've added the` +
      `country code with (+) in the beginning. ` +
      `For example: +41 311111111, +41 (0)31 633 60 01, +49 9072 1111, etc..`,
  })
  @IsPhoneNumber()
  phoneNumber: string;

  @Field()
  @Length(
    validatorsConfig.get('name.minLength'),
    validatorsConfig.get('name.maxLength'),
  )
  name: string;

  @Field(() => Date)
  @IsDate()
  dateOfBirth: Date;

  @Field(() => String)
  primaryCoachId: string;

  @Field(() => [String], { nullable: true })
  usersIds: string[];
}

/***********************************************************************************************************************
 ******************************************** Return params for gql methods ********************************************
 **********************************************************************************************************************/
@ObjectType()
@Schema({ versionKey: false, timestamps: true })
export class Member extends Identifier {
  @Prop({ unique: true, index: true })
  @Field(() => String)
  phoneNumber: string;

  @Prop()
  @Field(() => String, { description: 'name' })
  name: string;

  @Prop({ type: Date })
  @Field(() => Date)
  dateOfBirth: Date;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: User.name,
  })
  @Field(() => User, { description: 'primary user' })
  primaryCoach: User;

  @Prop({ type: [{ type: mongoose.Schema.Types.ObjectId, ref: User.name }] })
  @Field(() => [User], { description: 'users reference object' })
  users: User[];
}

/***********************************************************************************************************************
 ************************************************** Exported Schemas ***************************************************
 **********************************************************************************************************************/
export type MemberDocument = Member & Document;
export const MemberDto = SchemaFactory.createForClass(Member);
