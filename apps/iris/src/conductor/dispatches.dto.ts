import { CancelNotificationType, ContentKey, NotificationType, ServiceName } from '@argus/pandora';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { FailureReason } from '../common';
import { ISoftDelete } from '../db';
import { ProviderResult } from '../providers';

/**************************************************************************************************
 **************************************** Enums and const *****************************************
 *************************************************************************************************/
export enum DispatchStatus {
  received = 'received', //the event is received, and it's not time to be processed yet
  acquired = 'acquired', //the event is currently being handled
  done = 'done', //the event was sent successfully
  error = 'error', //failed to send the event, after retry
  canceled = 'canceled', //the event was canceled, and is no longer relevant
}

export const defaultDispatchParams = {
  status: DispatchStatus.received,
  retryCount: 0,
};

export class SenderClient {
  id: string;
  firstName: string;
  avatar?: string;
}

/**************************************************************************************************
 ***************************************** Mongodb schemas ****************************************
 *************************************************************************************************/
@Schema({ versionKey: false, timestamps: true })
export class Dispatch {
  /**
   * Shared fields from the producer of the message (aka hepius) as described in ICreateDispatch
   */
  @Prop({ index: true, unique: true })
  dispatchId: string;

  @Prop()
  correlationId: string;

  @Prop()
  serviceName: ServiceName;

  @Prop()
  notificationType: NotificationType | CancelNotificationType;

  @Prop()
  recipientClientId: string;

  @Prop({ isNan: true })
  senderClientId?: string;

  @Prop({ isNan: true })
  sendBirdChannelUrl?: string;

  @Prop({ isNan: true })
  appointmentId?: string;

  @Prop({ isNan: true })
  appointmentTime?: Date;

  @Prop({ isNan: true })
  assessmentName?: string;

  @Prop({ isNan: true })
  assessmentScore?: string;

  @Prop({ isNan: true })
  peerId?: string;

  @Prop({ isNan: true })
  contentKey?: ContentKey;

  @Prop({ isNan: true })
  content?: string;

  @Prop({ isNan: true })
  chatLink?: string;

  @Prop({ isNan: true })
  scheduleLink?: string;

  @Prop({ isNan: true })
  sentAt?: Date;

  @Prop({ isNan: true })
  triggersAt?: Date;

  @Prop({ isNan: true })
  triggeredId?: string;

  @Prop({ isNan: true })
  notificationId?: string;

  @Prop({ isNan: true })
  path?: string;

  @Prop({ isNan: true })
  journalImageDownloadLink?: string;

  @Prop({ isNan: true })
  journalAudioDownloadLink?: string;

  /**
   * Internal Iris fields for dispatching a message
   */
  @Prop({ default: defaultDispatchParams.status })
  status?: DispatchStatus;

  @Prop({ isNaN: true })
  deliveredAt?: Date;

  @Prop({ default: defaultDispatchParams.retryCount })
  retryCount?: number;

  @Prop({ isNan: true })
  failureReasons?: FailureReason[];

  @Prop({ isNan: true })
  providerResult?: ProviderResult;
}

export type DispatchInternalUpdate = Partial<Dispatch>;

/**************************************************************************************************
 **************************************** Exported Schemas ****************************************
 *************************************************************************************************/
export type DispatchDocument = Dispatch & Document & ISoftDelete<Dispatch>;
export const DispatchDto = SchemaFactory.createForClass(Dispatch);
