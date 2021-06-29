import {
  Field,
  ObjectType,
  InputType,
  registerEnumType,
} from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import * as mongoose from 'mongoose';

export enum CoachRole {
  coach = 'Behaviour Coach',
  nurse = 'Nurse',
}
registerEnumType(CoachRole, { name: 'CoachRole' });

/***********************************************************************************************************************
 ******************************************** Input params for gql methods *********************************************
 **********************************************************************************************************************/
@InputType()
export class CreateCoachParams {
  @Field()
  name: string;

  @Field({ nullable: false })
  email: string;

  @Field()
  role: string;

  @Field()
  photoUrl?: string;
}

@InputType()
export class GetCoachParams {
  @Field()
  id: string;
}

/***********************************************************************************************************************
 ******************************************** Return params for gql methods ********************************************
 **********************************************************************************************************************/
@ObjectType()
@Schema({ versionKey: false })
export class Coach {
  //TODO _id + id in mongodb
  //TODO define prop which works with get/insert
  //TODO add required
  //TODO add class-validator

  @Field(() => String, { description: 'coach id' })
  // @Prop({ type: mongoose.Types.ObjectId })
  // @Prop()
  _id: string;

  @Prop()
  @Field(() => String, { description: 'name' })
  name: string;

  @Prop({ unique: true })
  @Field(() => String)
  email: string;

  @Prop()
  @Field(() => String, {
    description: 'role of the coach: behaviour coach/nurse',
  })
  role: string;

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
export type CoachDocument = Coach & mongoose.Document;
export const CoachSchema = SchemaFactory.createForClass(Coach);
