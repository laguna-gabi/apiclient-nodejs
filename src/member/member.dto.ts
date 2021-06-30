import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import * as mongoose from 'mongoose';
import { Document } from 'mongoose';
import { User } from '../user/user.dto';
import { Identifier } from '../common';

/***********************************************************************************************************************
 ******************************************** Input params for gql methods *********************************************
 **********************************************************************************************************************/
@InputType()
export class CreateMemberParams {
  @Field({ nullable: false })
  phoneNumber: string;

  @Field()
  name: string;

  @Field(() => Date)
  dateOfBirth: Date;

  @Field(() => String)
  primaryCoachId: string;

  @Field(() => [String])
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
