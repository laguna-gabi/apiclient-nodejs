import { IsObjectId } from '@argus/hepiusClient';
import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import * as mongooseDelete from 'mongoose-delete';
import { ErrorType, Errors, RecordingType } from '../common';
import { ISoftDelete, audit, useFactoryOptions } from '../db';

/**************************************************************************************************
 ********************************** Input params for gql methods **********************************
 *************************************************************************************************/

@InputType({ isAbstract: true })
export class UpdateRecordingParams {
  @Field(() => String, { nullable: true })
  id?: string;

  @Field(() => String)
  memberId: string;

  @Field(() => String, { nullable: true })
  userId?: string;

  @Field(() => Date, { nullable: true })
  start?: Date;

  @Field(() => Date, { nullable: true })
  end?: Date;

  @Field(() => Boolean, { nullable: true })
  answered?: boolean;

  @Field(() => String, { nullable: true })
  phone?: string;

  @Field(() => RecordingType, { nullable: true })
  recordingType?: RecordingType;

  @Field(() => String, { nullable: true })
  appointmentId?: string;

  @Field(() => Boolean, { nullable: true })
  consent?: boolean;

  @Field(() => Boolean, { nullable: true })
  identityVerification?: boolean;

  journeyId: string;
}

@InputType({ isAbstract: true })
export class UpdateRecordingReviewParams {
  @Field(() => String)
  recordingId: string;

  @Field(() => String, { nullable: true })
  content?: string;

  userId: string;
}

@InputType()
export class RecordingLinkParams {
  @Field(() => String)
  id: string;

  @Field(() => String)
  @IsObjectId({ message: Errors.get(ErrorType.memberIdInvalid) })
  memberId: string;
}

@InputType()
export class MultipartUploadRecordingLinkParams {
  @Field(() => String)
  id: string;

  @Field(() => String)
  @IsObjectId({ message: Errors.get(ErrorType.memberIdInvalid) })
  memberId: string;

  @Field(() => Number)
  partNumber: number;

  @Field(() => String, { nullable: true })
  uploadId?: string;
}

@InputType()
export class CompleteMultipartUploadParams {
  @Field(() => String)
  id: string;

  @Field(() => String)
  @IsObjectId({ message: Errors.get(ErrorType.memberIdInvalid) })
  memberId: string;

  @Field(() => String)
  uploadId: string;
}

/**************************************************************************************************
 ********************************* Return params for gql methods **********************************
 *************************************************************************************************/

@ObjectType()
@Schema({ versionKey: false, timestamps: true })
export class RecordingReview {
  @Prop({ type: Types.ObjectId, index: true })
  @Field(() => String)
  userId: Types.ObjectId;

  @Prop()
  @Field(() => String, { nullable: true })
  content?: string;

  @Field(() => Date)
  createdAt: Date;

  @Field(() => Date)
  updatedAt: Date;
}

@ObjectType()
export class MultipartUploadInfo {
  @Field(() => String)
  url: string;

  @Field(() => String)
  uploadId: string;
}

@ObjectType()
@Schema({ versionKey: false, timestamps: true })
export class Recording {
  @Prop({ type: String, index: true, unique: true })
  @Field(() => String)
  id: string;

  @Prop({ type: Types.ObjectId, index: true })
  @Field(() => String)
  memberId: Types.ObjectId;

  @Prop({ index: true, type: Types.ObjectId })
  journeyId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, index: true })
  @Field(() => String, { nullable: true })
  userId?: Types.ObjectId;

  @Prop()
  @Field(() => Date, { nullable: true })
  start?: Date;

  @Prop()
  @Field(() => Date, { nullable: true })
  end?: Date;

  @Prop({ default: false })
  @Field(() => Boolean, { nullable: true })
  answered?: boolean;

  @Prop()
  @Field(() => String, { nullable: true })
  phone?: string;

  @Prop({ type: String, enum: RecordingType })
  @Field(() => RecordingType, { nullable: true })
  recordingType?: RecordingType;

  @Prop({ type: Types.ObjectId, index: true })
  @Field(() => String)
  appointmentId?: Types.ObjectId;

  @Prop({ type: Boolean })
  @Field(() => Boolean, { nullable: true })
  consent?: boolean;

  @Prop({ type: Boolean })
  @Field(() => Boolean, { nullable: true })
  identityVerification?: boolean;

  @Prop({ type: RecordingReview })
  @Field(() => RecordingReview, { nullable: true })
  review?: RecordingReview;
}

/**************************************************************************************************
 **************************************** Exported Schemas ****************************************
 *************************************************************************************************/
export type RecordingDocument = Recording & Document & ISoftDelete<RecordingDocument>;
export const RecordingDto = audit(
  SchemaFactory.createForClass(Recording).plugin(mongooseDelete, useFactoryOptions),
);
