import { Field, InputType, ObjectType, registerEnumType } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { IsEmail, IsOptional, IsPhoneNumber } from 'class-validator';
import { Document, Types } from 'mongoose';
import { ISoftDelete, audit, useFactoryOptions } from '../db';
import { ErrorType, Errors, Identifier, IsObjectId } from '../common';
import * as mongooseDelete from 'mongoose-delete';

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

registerEnumType(Relationship, { name: 'Relationship' });

/**************************************************************************************************
 ********************************** Input params for gql methods **********************************
 *************************************************************************************************/

@InputType()
export class BaseCaregiverMutationParams {
  @Field(() => Relationship)
  relationship: Relationship;

  @Field(() => String)
  lastName: string;

  @Field(() => String)
  firstName: string;

  @Field(() => String)
  @IsPhoneNumber(undefined, { message: Errors.get(ErrorType.caregiverPhoneInvalid) })
  phone: string;

  @Prop()
  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsEmail(undefined, { message: Errors.get(ErrorType.caregiverEmailInvalid) })
  email?: string;

  @Field(() => String, { nullable: true })
  @IsObjectId({ message: Errors.get(ErrorType.memberIdInvalid) })
  memberId?: string;
}

@InputType()
export class AddCaregiverParams extends BaseCaregiverMutationParams {}

@InputType()
export class UpdateCaregiverParams extends BaseCaregiverMutationParams {
  @Field(() => String)
  @IsObjectId({ message: Errors.get(ErrorType.caregiverIdInvalid) })
  id: string;
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

  @Prop()
  @Field(() => Relationship)
  relationship: Relationship;
}

/**************************************************************************************************
 **************************************** Exported Schemas ****************************************
 *************************************************************************************************/
export type CaregiverDocument = Caregiver & Document & ISoftDelete<Caregiver>;
export const CaregiverDto = audit(
  SchemaFactory.createForClass(Caregiver).plugin(mongooseDelete, useFactoryOptions),
);
