import { Field, InputType, ObjectType, OmitType } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { RecordingType } from '../common';

/**************************************************************************************************
 ********************************** Input params for gql methods **********************************
 *************************************************************************************************/

@InputType({ isAbstract: true })
export class UpdateRecordingParams {
  @Field(() => String)
  id: string;

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

  @Field(() => String, { nullable: true })
  appointmentId?: string;

  @Field(() => RecordingType, { nullable: true })
  recordingType?: RecordingType;
}

/**************************************************************************************************
 ********************************* Return params for gql methods **********************************
 *************************************************************************************************/

@ObjectType()
@Schema({ versionKey: false, timestamps: true })
export class Recording {
  @Prop({ type: String, index: true, unique: true })
  @Field(() => String)
  id: string;

  @Prop({ type: Types.ObjectId, index: true })
  @Field(() => String)
  memberId: Types.ObjectId;

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

  @Prop()
  @Field(() => RecordingType, { nullable: true })
  recordingType?: RecordingType;

  @Prop({ type: Types.ObjectId, index: true })
  @Field(() => String)
  appointmentId?: Types.ObjectId;

  @Prop({ type: Boolean })
  @Field(() => Boolean, { nullable: true })
  deletedMedia?: boolean;
}

@ObjectType()
export class RecordingOutput extends OmitType(Recording, ['memberId'] as const) {}

/**************************************************************************************************
 **************************************** Exported Schemas ****************************************
 *************************************************************************************************/
export type RecordingDocument = Recording & Document;
export const MemberRecordingDto = SchemaFactory.createForClass(Recording);
