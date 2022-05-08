import { ClientCategory, ServiceName } from '@argus/pandora';
import { Field, ObjectType } from '@nestjs/graphql';

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
export class TranscriptData {
  @Field(() => String, { nullable: true })
  transcriptLink?: string;

  @Field(() => ConversationPercentage, { nullable: true })
  conversationPercentage?: ConversationPercentage;

  @Field(() => String, { nullable: true })
  speakerA?: ClientCategory;

  @Field(() => String)
  status: TranscriptStatus;
}
