import { ObjectType, Field, InputType } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import * as mongoose from 'mongoose';
import { Id } from '../common';
import { Coach } from '../coach/coach.dto';

/***********************************************************************************************************************
 ******************************************** Input params for gql methods *********************************************
 **********************************************************************************************************************/
@InputType()
export class CreateMemberParams {
  @Field()
  name: string;

  @Field((type) => String)
  primaryCoachId: string;

  @Field((type) => [String])
  coachIds: string[];
}

@InputType()
export class GetMemberParams {
  @Field()
  id: string;
}

/***********************************************************************************************************************
 ******************************************** Return params for gql methods ********************************************
 **********************************************************************************************************************/
@ObjectType()
@Schema({ versionKey: false })
export class Member extends Id {
  @Prop()
  @Field(() => String, { description: 'name' })
  name: string;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: Coach.name,
  })
  @Field(() => Coach, { description: 'primary coach' })
  primaryCoach: Coach;

  @Prop({
    type: [mongoose.Schema.Types.ObjectId],
    ref: Coach.name,
  })
  @Field(() => [Coach], { description: 'coaches reference object' })
  coaches: [Coach];
}

/***********************************************************************************************************************
 ************************************************** Exported Schemas ***************************************************
 **********************************************************************************************************************/
export type MemberDocument = Member & Document;
export const MemberSchema = SchemaFactory.createForClass(Member);
