import { ClientCategory } from '@argus/irisClient';
import { Language, Platform } from '@argus/pandora';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ISoftDelete } from '../db';

/**************************************************************************************************
 ***************************************** Mongodb schemas ****************************************
 ******************** based on IUpdateClientSettings, without IInnerQueueTypes ********************
 *************************************************************************************************/
@Schema({ versionKey: false, timestamps: true })
export class ClientSettings {
  /**
   * Shared fields for User and Member
   */
  @Prop({ index: true })
  id: string;

  @Prop({ type: String, enum: ClientCategory })
  clientCategory: ClientCategory;

  @Prop({ isNaN: true })
  phone?: string;

  @Prop()
  firstName?: string;

  @Prop()
  lastName?: string;

  /**
   * Member only fields
   */
  @Prop({ isNaN: true })
  orgName?: string;

  @Prop()
  zipCode?: string;

  @Prop({ type: String, enum: Language })
  language?: Language;

  @Prop({ isNaN: true, type: String, enum: Platform })
  platform?: Platform;

  @Prop({ isNaN: true })
  isPushNotificationsEnabled?: boolean;

  @Prop({ isNaN: true })
  isAppointmentsReminderEnabled?: boolean;

  @Prop({ isNaN: true })
  isRecommendationsEnabled?: boolean;

  @Prop({ isNaN: true })
  isTodoNotificationsEnabled?: boolean;

  @Prop({ isNaN: true })
  externalUserId?: string;

  @Prop()
  firstLoggedInAt?: Date;

  /**
   * User only fields
   */
  @Prop()
  avatar?: string;
}

/**************************************************************************************************
 **************************************** Exported Schemas ****************************************
 *************************************************************************************************/
export type ClientSettingsDocument = ClientSettings & Document & ISoftDelete<ClientSettings>;
export const ClientSettingsDto = SchemaFactory.createForClass(ClientSettings);
