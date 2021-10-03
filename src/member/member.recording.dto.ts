import { Field, InputType, ObjectType, OmitType } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';

/**************************************************************************************************
 ********************************** Input params for gql methods **********************************
 *************************************************************************************************/

@InputType({ isAbstract: true })
export class UpdateRecordingParams {
  @Field(() => String)
  id: string;

  @Field(() => String)
  memberId: string;

  @Field(() => Date, { nullable: true })
  start?: Date;

  @Field(() => Date, { nullable: true })
  end?: Date;
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

  @Prop()
  @Field(() => Date, { nullable: true })
  start?: Date;

  @Prop()
  @Field(() => Date, { nullable: true })
  end?: Date;
}

@ObjectType()
export class RecordingOutput extends OmitType(Recording, ['memberId'] as const) {}

/**************************************************************************************************
 **************************************** Exported Schemas ****************************************
 *************************************************************************************************/
export type RecordingDocument = Recording & Document;
export const MemberRecordingDto = SchemaFactory.createForClass(Recording);
