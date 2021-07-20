import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from '../user';
import { Errors, ErrorType, Identifier, validPhoneNumbersExamples } from '../common';
import { IsDate, IsPhoneNumber, Length } from 'class-validator';
import * as config from 'config';

const validatorsConfig = config.get('graphql.validators');

/**************************************************************************************************
 ********************************** Input params for gql methods **********************************
 *************************************************************************************************/
@InputType()
export class CreateMemberParams {
  @Field({ description: validPhoneNumbersExamples })
  @IsPhoneNumber(undefined, {
    message: Errors.get(ErrorType.memberPhoneNumber),
  })
  phoneNumber: string;

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
  @IsDate({ message: Errors.get(ErrorType.memberDate) })
  dateOfBirth: Date;

  @Field(() => String)
  primaryCoachId: string;

  @Field(() => [String], { nullable: true })
  usersIds: string[];
}

/**************************************************************************************************
 ********************************* Return params for gql methods **********************************
 *************************************************************************************************/
@ObjectType()
@Schema({ versionKey: false, timestamps: true })
export class Member extends Identifier {
  @Prop({ unique: true, index: true })
  @Field(() => String)
  phoneNumber: string;

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

  @Prop({ type: Types.ObjectId, ref: User.name })
  @Field(() => User, { description: 'primary user' })
  primaryCoach: User;

  @Prop({ type: [{ type: Types.ObjectId, ref: User.name }] })
  @Field(() => [User], { description: 'users reference object' })
  users: User[];

  @Prop()
  @Field(() => String)
  dischargeNotesLink: string;

  @Prop()
  @Field(() => String)
  dischargeInstructionsLink: string;
}

/**************************************************************************************************
 **************************************** Exported Schemas ****************************************
 *************************************************************************************************/
export type MemberDocument = Member & Document;
export const MemberDto = SchemaFactory.createForClass(Member);
