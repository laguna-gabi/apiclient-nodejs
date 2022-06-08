import { Field, ObjectType } from '@nestjs/graphql';
import { Prop, Schema } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { Identifier } from '.';

/**************************************************************************************************
 ******************************* Enum registration for gql methods ********************************
 *************************************************************************************************/
export enum Relationship {
  spouse = 'spouse',
  partner = 'partner',
  parent = 'parent',
  child = 'child',
  sibling = 'sibling',
  friend = 'friend',
  neighbour = 'neighbour',
  professionalCaregiver = 'professional caregiver',
  other = 'other',
}

/********∏******************************************************************************************
 ********************************* Return params for gql methods **********************************
 *************************************************************************************************/
@ObjectType()
@Schema({ versionKey: false, timestamps: true })
export class Caregiver extends Identifier {
  @Prop({ index: true, type: Types.ObjectId })
  @Field(() => String)
  memberId: Types.ObjectId;

  @Prop({ index: true, type: Types.ObjectId })
  journeyId: Types.ObjectId;

  @Prop()
  @Field(() => String)
  lastName: string;

  @Prop()
  @Field(() => String)
  firstName: string;

  @Prop()
  @Field(() => String)
  phone: string;

  @Prop()
  @Field(() => String, { nullable: true })
  email?: string;

  @Prop({ type: String, enum: Relationship })
  @Field(() => Relationship)
  relationship: Relationship;
}
