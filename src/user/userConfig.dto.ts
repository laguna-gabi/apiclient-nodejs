import { Field, ObjectType } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { audit } from '../db';

/**************************************************************************************************
 ********************************* Return params for gql methods **********************************
 *************************************************************************************************/

@ObjectType()
@Schema({ versionKey: false, timestamps: true })
export class UserConfig {
  @Prop({ type: Types.ObjectId, unique: true, index: true })
  @Field(() => String)
  userId: Types.ObjectId;

  @Prop()
  @Field(() => String)
  accessToken: string;
}

/**************************************************************************************************
 **************************************** Exported Schemas ****************************************
 *************************************************************************************************/
export type UserConfigDocument = UserConfig & Document;
export const UserConfigDto = audit(SchemaFactory.createForClass(UserConfig));
