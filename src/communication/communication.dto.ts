import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { UserRole } from '../user';

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

  @Prop({ type: Types.ObjectId, index: true })
  userId: Types.ObjectId;

  @Prop({ index: true })
  sendBirdChannelUrl: string;
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

@ObjectType()
export class UnreadMessagesCount {
  @Field(() => String)
  memberId: string;

  @Field(() => String)
  userId: string;

  @Field(() => Number)
  count: number;
}

@ObjectType()
export class UserInfo {
  @Field()
  id: string;

  @Field()
  firstName: string;

  @Field()
  lastName: string;

  @Field({ nullable: true })
  avatar?: string;

  @Field(() => [UserRole])
  roles: UserRole[];
}

@ObjectType()
export class MemberCommunicationInfo {
  @Field()
  memberLink: string;

  @Field(() => UserInfo)
  user: UserInfo;
}

/**************************************************************************************************
 **************************************** Exported Schemas ****************************************
 *************************************************************************************************/
export type CommunicationDocument = Communication & Document;
export const CommunicationDto = SchemaFactory.createForClass(Communication);
