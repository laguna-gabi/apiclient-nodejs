import { Field, InputType, Int, ObjectType, registerEnumType } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Min } from 'class-validator';
import { ErrorType, Errors, Identifier } from '../common';

/**************************************************************************************************
 ******************************* Enum registration for gql methods ********************************
 *************************************************************************************************/
export enum OrgType {
  hospital = 'hospital',
  service = 'service',
}

registerEnumType(OrgType, { name: 'OrgType' });

/**************************************************************************************************
 ********************************** Input params for gql methods **********************************
 *************************************************************************************************/
@InputType()
export class CreateOrgParams {
  @Field()
  name: string;

  @Field(() => OrgType)
  type: OrgType;

  @Field(() => Int)
  @Min(1, { message: Errors.get(ErrorType.orgTrialDurationOutOfRange) })
  trialDuration: number; //in days

  @Field()
  zipCode: string;
}

/**************************************************************************************************
 ********************************* Return params for gql methods **********************************
 *************************************************************************************************/

@ObjectType()
@Schema({ versionKey: false, timestamps: true })
export class Org extends Identifier {
  @Prop()
  @Field(() => OrgType)
  type: OrgType;

  @Prop({ unique: true, index: true })
  @Field(() => String)
  name: string;

  @Prop()
  @Field(() => Int)
  trialDuration: number; //in days

  @Prop()
  @Field(() => String)
  zipCode: string;
}

/**************************************************************************************************
 **************************************** Exported Schemas ****************************************
 *************************************************************************************************/
export type OrgDocument = Org & Document;
export const OrgDto = SchemaFactory.createForClass(Org);
