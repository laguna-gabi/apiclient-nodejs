import { NotificationType, SourceApi, TriggeredApi } from '@lagunahealth/pandora';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

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
  triggeredApi: TriggeredApi;

  @Prop()
  sourceApi: SourceApi;

  @Prop()
  notificationType: NotificationType;

  @Prop()
  recipientClientId: string;

  @Prop({ isNan: true })
  senderClientId?: string;

  @Prop({ isNan: true })
  sendBirdChannelUrl?: string;

  @Prop({ isNan: true })
  appointmentId?: string;

  @Prop({ isNan: true })
  peerId?: string;

  @Prop({ isNan: true })
  content?: string;

  @Prop({ isNan: true })
  chatLink?: boolean;

  @Prop({ isNan: true })
  triggeredAt?: Date;

  @Prop({ isNan: true })
  notificationId?: string;

  /**
   * Internal Iris fields for dispatching a message
   */
  @Prop({ default: defaultDispatchParams.status })
  status: DispatchStatus;

  @Prop({ isNaN: true })
  deliveredAt?: Date;

  @Prop({ default: defaultDispatchParams.retryCount })
  retryCount: number;

  @Prop({ isNan: true })
  failureReason?: string;
}

/**************************************************************************************************
 **************************************** Exported Schemas ****************************************
 *************************************************************************************************/
export type DispatchDocument = Dispatch & Document;
export const DispatchDto = SchemaFactory.createForClass(Dispatch);
