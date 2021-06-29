import { ObjectType, Field, InputType } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import * as mongoose from 'mongoose';
import { Coach } from '../coach/coach.dto';
import { Id } from '../common';

/***********************************************************************************************************************
 ******************************************** Input params for gql methods *********************************************
 **********************************************************************************************************************/
@InputType()
export class CreateMemberParams {
  @Field()
  name: string;

  @Field({ nullable: false })
  phoneNumber: string;

  @Field(() => String)
  primaryCoachId: string;

  @Field(() => [String])
  coachIds: string[];
}

/***********************************************************************************************************************
 ******************************************** Return params for gql methods ********************************************
 **********************************************************************************************************************/
@ObjectType()
@Schema({ versionKey: false })
export class Member extends Id {
  @Prop({ unique: true, index: true })
  @Field(() => String)
  phoneNumber: string;

  @Prop()
  @Field(() => String, { description: 'name' })
  name: string;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: Coach.name,
  })
  @Field(() => Coach, { description: 'primary coach' })
  primaryCoach: Coach;

  @Prop({ type: [{ type: mongoose.Schema.Types.ObjectId, ref: Coach.name }] })
  @Field(() => [Coach], { description: 'coaches reference object' })
  coaches: Coach[];
}

/***********************************************************************************************************************
 ************************************************** Exported Schemas ***************************************************
 **********************************************************************************************************************/
export type MemberDocument = Member & Document;
export const MemberSchema = SchemaFactory.createForClass(Member);
