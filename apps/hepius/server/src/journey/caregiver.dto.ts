import { Field, InputType, registerEnumType } from '@nestjs/graphql';
import { Prop, SchemaFactory } from '@nestjs/mongoose';
import { IsEmail, IsOptional, IsPhoneNumber, Length } from 'class-validator';
import { Document } from 'mongoose';
import { ISoftDelete, audit, useFactoryOptions } from '../db';
import { ErrorType, Errors, maxLength, minLength } from '../common';
import * as mongooseDelete from 'mongoose-delete';
import { Caregiver, IsObjectId, Relationship } from '@argus/hepiusClient';

registerEnumType(Relationship, { name: 'Relationship' });

/**************************************************************************************************
 ********************************** Input params for gql methods **********************************
 *************************************************************************************************/

@InputType()
export class BaseCaregiverMutationParams {
  @Field(() => Relationship)
  relationship: Relationship;

  @Field(() => String)
  @Length(minLength, maxLength, { message: Errors.get(ErrorType.caregiverMinMaxLength) })
  lastName: string;

  @Field(() => String)
  @Length(minLength, maxLength, { message: Errors.get(ErrorType.caregiverMinMaxLength) })
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

  journeyId?: string;
}

@InputType()
export class AddCaregiverParams extends BaseCaregiverMutationParams {}

@InputType()
export class UpdateCaregiverParams extends BaseCaregiverMutationParams {
  @Field(() => String)
  @IsObjectId({ message: Errors.get(ErrorType.caregiverIdInvalid) })
  id: string;
}

/**************************************************************************************************
 **************************************** Exported Schemas ****************************************
 *************************************************************************************************/
export type CaregiverDocument = Caregiver & Document & ISoftDelete<Caregiver>;
export const CaregiverDto = audit(
  SchemaFactory.createForClass(Caregiver).plugin(mongooseDelete, useFactoryOptions),
);
