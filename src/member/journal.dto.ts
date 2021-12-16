import { Field, InputType, ObjectType, registerEnumType } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Identifier } from '../common';

export enum ImageType {
  NormalImage = '_NormalImage',
  SmallImage = '_SmallImage',
}

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

/**************************************************************************************************
 ********************************** Input params for gql methods **********************************
 *************************************************************************************************/

@InputType()
export class UpdateJournalTextParams {
  @Field(() => String)
  id: string;

  @Field(() => String)
  text: string;
}

@InputType()
export class GetMemberUploadJournalLinkParams {
  @Field(() => String)
  id: string;

  @Field(() => ImageFormat)
  imageFormat?: ImageFormat;
}

export class UpdateJournalParams {
  id: string;

  memberId: string;

  text?: string;

  imageFormat?: ImageFormat;

  published?: boolean;
}

/********∏******************************************************************************************
 ********************************* Return params for gql methods **********************************
 *************************************************************************************************/

@ObjectType()
export class JournalImagesUploadLink {
  @Field(() => String, { nullable: true })
  normalImageLink?: string;
}

@ObjectType()
export class JournalImagesDownloadLinks extends JournalImagesUploadLink {
  @Field(() => String, { nullable: true })
  smallImageLink?: string;
}

@ObjectType()
@Schema({ versionKey: false, timestamps: true })
export class Journal extends Identifier {
  @Prop({ index: true, type: Types.ObjectId })
  @Field(() => String)
  memberId: Types.ObjectId;

  @Prop()
  @Field(() => String, { nullable: true })
  text?: string;

  @Prop({ default: false })
  @Field(() => Boolean)
  published: boolean;

  @Prop()
  @Field(() => ImageFormat, { nullable: true })
  imageFormat?: ImageFormat;

  @Field(() => JournalImagesDownloadLinks, { nullable: true })
  images?: JournalImagesDownloadLinks;

  @Field(() => Date)
  updatedAt: Date;
}

/**************************************************************************************************
 **************************************** Exported Schemas ****************************************
 *************************************************************************************************/
export type JournalDocument = Journal & Document;
export const JournalDto = SchemaFactory.createForClass(Journal);
