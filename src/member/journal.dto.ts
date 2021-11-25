import { Field, InputType, ObjectType, registerEnumType } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Identifier } from '../common';

/**************************************************************************************************
 ******************************* Enum registration for gql methods ********************************
 *************************************************************************************************/
export enum ImageFormat {
  jpeg = 'jpeg',
  jpg = 'jpg',
  gif = 'gif',
  bmp = 'bmp',
  png = 'png',
}

registerEnumType(ImageFormat, { name: 'ImageFormat' });

/**************************************************************************************************
 ********************************** Input params for gql methods **********************************
 *************************************************************************************************/

@InputType()
export class UpdateJournalParams {
  @Field(() => String)
  id: string;

  @Field(() => String)
  text: string;
}

@InputType()
export class GetMemberUploadJournalLinksParams {
  @Field(() => String)
  id: string;

  @Field(() => ImageFormat)
  imageFormat: ImageFormat;
}

/********∏******************************************************************************************
 ********************************* Return params for gql methods **********************************
 *************************************************************************************************/

@ObjectType()
export class JournalImagesLinks {
  @Field(() => String, { nullable: true })
  normalImageLink?: string;

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

  @Field(() => JournalImagesLinks, { nullable: true })
  images?: JournalImagesLinks;

  @Field(() => Date)
  updatedAt: Date;
}

/**************************************************************************************************
 **************************************** Exported Schemas ****************************************
 *************************************************************************************************/
export type JournalDocument = Journal & Document;
export const JournalDto = SchemaFactory.createForClass(Journal);
