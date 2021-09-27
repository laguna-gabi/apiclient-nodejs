import { Field, ObjectType } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Platform } from '../common';
import { Types } from 'mongoose';

/**************************************************************************************************
 ********************************* Return params for gql methods **********************************
 *************************************************************************************************/

@ObjectType()
@Schema({ versionKey: false, timestamps: true })
export class MemberConfig {
  @Prop({ type: Types.ObjectId, unique: true, index: true })
  @Field(() => String)
  memberId: Types.ObjectId;

  @Prop({ unique: true })
  @Field(() => String)
  externalUserId: string;

  @Prop({ default: Platform.web })
  @Field(() => Platform, { nullable: true })
  platform: Platform;

  @Prop()
  @Field(() => String, { nullable: true })
  accessToken: string;

  @Prop({ type: Boolean, default: false })
  @Field(() => Boolean)
  isPushNotificationsEnabled: boolean;
}

/**************************************************************************************************
 **************************************** Exported Schemas ****************************************
 *************************************************************************************************/
export type MemberConfigDocument = MemberConfig & Document;
export const MemberConfigDto = SchemaFactory.createForClass(MemberConfig);
