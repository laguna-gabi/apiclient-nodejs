import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { Platform } from '../common';
import { IsOptional } from 'class-validator';

/**************************************************************************************************
 ********************************** Input params for gql methods **********************************
 *************************************************************************************************/
@InputType()
export class UpdateMemberConfigParams {
  @Field(() => String)
  memberId: string;

  @Field(() => Platform, { nullable: true })
  @IsOptional()
  platform?: Platform;

  @Field(() => Boolean, { nullable: true })
  @IsOptional()
  isPushNotificationsEnabled?: boolean;

  @Field(() => Boolean, { nullable: true })
  @IsOptional()
  isAppointmentsReminderEnabled?: boolean;

  @Field(() => Boolean, { nullable: true })
  @IsOptional()
  isRecommendationsEnabled?: boolean;
}

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

  @Prop({ type: Boolean, default: true })
  @Field(() => Boolean)
  isPushNotificationsEnabled: boolean;

  @Prop({ type: Boolean, default: true })
  @Field(() => Boolean)
  isAppointmentsReminderEnabled?: boolean;

  @Prop({ type: Boolean, default: true })
  @Field(() => Boolean)
  isRecommendationsEnabled?: boolean;

  @Prop()
  @Field(() => Date, { nullable: true })
  firstLoggedInAt: Date;

  @Field(() => String, { nullable: false })
  articlesPath: string;
}

/**************************************************************************************************
 ********************************************* Archive ********************************************
 *************************************************************************************************/

@Schema({ versionKey: false, timestamps: true })
export class ArchiveMemberConfig extends MemberConfig {}

/**************************************************************************************************
 **************************************** Exported Schemas ****************************************
 *************************************************************************************************/
export type MemberConfigDocument = MemberConfig & Document;
export const MemberConfigDto = SchemaFactory.createForClass(MemberConfig);
export type ArchiveMemberConfigDocument = ArchiveMemberConfig & Document;
export const ArchiveMemberConfigDto = SchemaFactory.createForClass(ArchiveMemberConfig);
