import { Language, Platform } from '@argus/pandora';
import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { IsOptional } from 'class-validator';
import { Types } from 'mongoose';
import { ErrorType, Errors, IsObjectId } from '../common';
import { ISoftDelete } from '../db';
import { defaultMemberParams } from './member.dto';

/**************************************************************************************************
 ********************************** Input params for gql methods **********************************
 *************************************************************************************************/
@InputType()
export class UpdateMemberConfigParams {
  @IsObjectId({ message: Errors.get(ErrorType.memberIdInvalid) })
  memberId?: string;

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

  @Field(() => Boolean, { nullable: true })
  @IsOptional()
  isTodoNotificationsEnabled?: boolean;

  @Field(() => Language, { nullable: true })
  @IsOptional()
  language?: Language;
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

  @Prop({ type: String, enum: Platform, default: Platform.web })
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

  @Prop({ type: Boolean, default: true })
  @Field(() => Boolean)
  isTodoNotificationsEnabled?: boolean;

  @Prop()
  @Field(() => Date, { nullable: true })
  firstLoggedInAt: Date;

  @Prop({ type: String, enum: Language, default: defaultMemberParams.language })
  @Field(() => Language)
  language: Language;

  @Field(() => String, { nullable: false })
  articlesPath: string;

  @Field(() => Date)
  updatedAt: Date;
}

/**************************************************************************************************
 **************************************** Exported Schemas ****************************************
 *************************************************************************************************/
export type MemberConfigDocument = MemberConfig & Document & ISoftDelete<MemberConfig>;
export const MemberConfigDto = SchemaFactory.createForClass(MemberConfig);
