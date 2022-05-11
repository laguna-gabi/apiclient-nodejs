import { ClientCategory, ServiceName } from '@argus/pandora';
import { Field, ObjectType } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

export enum InnerQueueTypes {
  createTranscript = 'createTranscript',
}

export interface IInnerQueueTypes {
  type: InnerQueueTypes;
}

interface IDispatch extends IInnerQueueTypes {
  serviceName: ServiceName;
  correlationId: string;
}

export interface ICreateTranscript extends IDispatch {
  recordingId: string;
  memberId: string;
  userId: string;
}

export enum TranscriptStatus {
  received = 'received', // the event is received, and is being processed
  done = 'done', // the transcript is done
  error = 'error', // an error occurred
  canceled = 'canceled', // the event was canceled before it was processed
}

@ObjectType()
export class ConversationPercentage {
  @Field(() => Number)
  speakerA: number;

  @Field(() => Number)
  speakerB: number;

  @Field(() => Number)
  silence: number;
}

@ObjectType()
@Schema({ versionKey: false, timestamps: true })
export class Transcript {
  @Prop({ index: true, unique: true })
  recordingId: string;

  @Prop()
  memberId: string;

  @Prop()
  transcriptionId: string;

  @Prop({ isNan: true })
  failureReason?: string;

  /**
   * Fields for graphql response
   */
  @Prop({ type: String, enum: TranscriptStatus, default: TranscriptStatus.received })
  @Field(() => String)
  status: TranscriptStatus;

  @Prop({ isNaN: true })
  @Field(() => ConversationPercentage, { nullable: true })
  conversationPercentage?: ConversationPercentage;

  @Prop({ type: String, enum: ClientCategory, isNaN: true })
  @Field(() => String, { nullable: true })
  speakerA?: ClientCategory;

  @Field(() => String, { nullable: true })
  transcriptLink?: string;
}

/**************************************************************************************************
 **************************************** Exported Schemas ****************************************
 *************************************************************************************************/
export type TranscriptDocument = Transcript & Document;
export const TranscriptDto = SchemaFactory.createForClass(Transcript);
