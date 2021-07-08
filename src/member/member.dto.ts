import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import * as mongoose from 'mongoose';
import { User } from '../user';
import {
  Errors,
  ErrorType,
  Identifier,
  validPhoneNumbersExamples,
} from '../common';
import { IsDate, IsPhoneNumber, Length } from 'class-validator';
import * as config from 'config';

const validatorsConfig = config.get('graphql.validators');

/***********************************************************************************************************************
 ******************************************** Input params for gql methods *********************************************
 **********************************************************************************************************************/
@InputType()
export class CreateMemberParams {
  @Field({ description: validPhoneNumbersExamples })
  @IsPhoneNumber(undefined, {
    message: Errors.get(ErrorType.memberPhoneNumber),
  })
  phoneNumber: string;

  @Field()
  @Length(
    validatorsConfig.get('name.minLength'),
    validatorsConfig.get('name.maxLength'),
    { message: Errors.get(ErrorType.memberMinMaxLength) },
  )
  name: string;

  @Field(() => Date)
  @IsDate({ message: Errors.get(ErrorType.memberDate) })
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
export type MemberDocument = Member & mongoose.Document;
export const MemberDto = SchemaFactory.createForClass(Member);
