import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Field, InputType, ObjectType } from '@nestjs/graphql';

/**************************************************************************************************
 **************************************** Internal params *****************************************
 *************************************************************************************************/
export interface RegisterSendbirdUserParams {
  user_id: string;
  nickname: string;
  profile_url: string;
  issue_access_token: boolean;
  metadata: any;
}

export interface CreateSendbirdGroupChannelParams {
  name: string;
  channel_url: string;
  cover_url: string;
  inviter_id: string;
  user_ids: string[];
}

/**************************************************************************************************
 ********************************** Input params for gql methods **********************************
 *************************************************************************************************/
@InputType()
export class GetCommunicationParams {
  @Field(() => String)
  memberId: string;

  @Field(() => String)
  userId: string;
}

/**************************************************************************************************
 ********************************* Return params for gql methods **********************************
 *************************************************************************************************/
@Schema({ versionKey: false, timestamps: true })
export class Communication {
  @Prop({ type: Types.ObjectId, index: true })
  memberId: Types.ObjectId;

  @Prop({ index: true })
  userId: string;

  @Prop({ index: true, unique: true })
  sendbirdChannelUrl: string;
}

@ObjectType()
export class Chat {
  @Field(() => String)
  memberLink: string;

  @Field(() => String)
  userLink: string;
}

@ObjectType()
export class CommunicationInfo {
  @Field(() => String)
  memberId: string;

  @Field(() => String)
  userId: string;

  @Field(() => Chat)
  chat: Chat;
}

/**************************************************************************************************
 **************************************** Exported Schemas ****************************************
 *************************************************************************************************/
export type CommunicationDocument = Communication & Document;
export const CommunicationDto = SchemaFactory.createForClass(Communication);
