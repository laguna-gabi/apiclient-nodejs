import { Field, ObjectType, registerEnumType } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum AlertType {
  appointmentScheduledUser = 'appointmentScheduledUser',
  memberAssigned = 'memberAssigned',
  memberNotFeelingWellMessage = 'memberNotFeelingWellMessage',
  newChatMessageFromMember = 'newChatMessageFromMember',
  assessmentSubmitScoreOverThreshold = 'assessmentSubmitScoreOverThreshold',
  customContent = 'customContent',
  journalContent = 'journalContent',
  appointmentReviewed = 'appointmentReviewed',
  appointmentReviewOverdue = 'appointmentReviewOverdue',
  actionItemOverdue = 'actionItemOverdue',
}

registerEnumType(AlertType, { name: 'AlertType' });

@ObjectType()
export class Alert {
  @Field(() => String)
  id: string;

  @Field(() => String)
  memberId: string;

  @Field(() => AlertType)
  type: AlertType;

  @Field(() => String)
  text: string;

  @Field(() => Date)
  date: Date;

  @Field(() => Boolean)
  isNew: boolean;

  @Field(() => Boolean)
  dismissed: boolean;
}

@Schema({ versionKey: false, timestamps: true, _id: false })
export class DismissedAlert {
  @Prop()
  alertId: string;

  @Prop({ type: Types.ObjectId, index: true })
  userId: Types.ObjectId;
}

/**************************************************************************************************
 **************************************** Exported Schemas ****************************************
 *************************************************************************************************/
export type DismissedAlertDocument = DismissedAlert & Document;
export const DismissedAlertDto = SchemaFactory.createForClass(DismissedAlert).index(
  { alertId: 1, user: 1 },
  { unique: true },
);
