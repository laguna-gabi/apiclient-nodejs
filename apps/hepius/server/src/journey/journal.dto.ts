import { Identifier, IsObjectId } from '@argus/hepiusClient';
import { Field, InputType, ObjectType, registerEnumType } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import * as mongooseDelete from 'mongoose-delete';
import { ErrorType, Errors } from '../common';
import { ISoftDelete } from '../db';
import { audit } from '../db/middleware';
import { useFactoryOptions } from '../db/utils';

export enum ImageType {
  NormalImage = '_NormalImage',
  SmallImage = '_SmallImage',
}

export const AudioType = '_Audio';

/**************************************************************************************************
 ******************************* Enum registration for gql methods ********************************
 *************************************************************************************************/
export enum ImageFormat {
  jpeg = 'jpeg',
  jpg = 'jpg',
  gif = 'gif',
  png = 'png',
}

registerEnumType(ImageFormat, { name: 'ImageFormat' });

export enum AudioFormat {
  m4a = 'm4a',
  mp3 = 'mp3',
}

registerEnumType(AudioFormat, { name: 'AudioFormat' });

/**************************************************************************************************
 ********************************** Input params for gql methods **********************************
 *************************************************************************************************/

@InputType()
export class UpdateJournalTextParams {
  @Field(() => String)
  @IsObjectId({ message: Errors.get(ErrorType.journeyJournalIdInvalid) })
  id: string;

  @Field(() => String)
  text: string;
}

@InputType()
export class GetMemberUploadJournalImageLinkParams {
  @Field(() => String)
  @IsObjectId({ message: Errors.get(ErrorType.journeyJournalIdInvalid) })
  id: string;

  @Field(() => ImageFormat)
  imageFormat?: ImageFormat;
}

@InputType()
export class GetMemberUploadJournalAudioLinkParams {
  @Field(() => String)
  id: string;

  @Field(() => AudioFormat)
  audioFormat?: AudioFormat;
}

export class UpdateJournalParams {
  id: string;
  memberId: string;
  journeyId: string;
  text?: string;
  imageFormat?: ImageFormat;
  audioFormat?: AudioFormat;
  published?: boolean;
}

/********∏******************************************************************************************
 ********************************* Return params for gql methods **********************************
 *************************************************************************************************/

@ObjectType()
export class JournalUploadImageLink {
  @Field(() => String, { nullable: true })
  normalImageLink?: string;
}

@ObjectType()
export class JournalUploadAudioLink {
  @Field(() => String, { nullable: true })
  audioLink?: string;
}

@ObjectType()
export class JournalDownloadLinks {
  @Field(() => String, { nullable: true })
  normalImageLink?: string;

  @Field(() => String, { nullable: true })
  smallImageLink?: string;

  @Field(() => String, { nullable: true })
  audioLink?: string;
}

@ObjectType()
@Schema({ versionKey: false, timestamps: true })
export class Journal extends Identifier {
  @Prop({ index: true, type: Types.ObjectId })
  @Field(() => String)
  memberId: Types.ObjectId;

  @Prop({ index: true, type: Types.ObjectId })
  journeyId: Types.ObjectId;

  @Prop()
  @Field(() => String, { nullable: true })
  text?: string;

  @Prop({ default: false })
  @Field(() => Boolean)
  published: boolean;

  @Prop({ type: String, enum: ImageFormat })
  @Field(() => ImageFormat, { nullable: true })
  imageFormat?: ImageFormat;

  @Prop({ type: String, enum: AudioFormat })
  @Field(() => AudioFormat, { nullable: true })
  audioFormat?: AudioFormat;

  @Field(() => JournalDownloadLinks, { nullable: true })
  journalDownloadLinks?: JournalDownloadLinks;

  @Field(() => Date)
  createdAt: Date;
}

/**************************************************************************************************
 **************************************** Exported Schemas ****************************************
 *************************************************************************************************/
export type JournalDocument = Journal & Document & ISoftDelete<Journal>;
export const JournalDto = audit(
  SchemaFactory.createForClass(Journal).plugin(mongooseDelete, useFactoryOptions),
);
