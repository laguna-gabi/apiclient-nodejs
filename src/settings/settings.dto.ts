import { Honorific, Language, Platform } from '@lagunahealth/pandora';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

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

  @Prop({ isNaN: true })
  platform?: Platform;

  @Prop({ isNaN: true })
  isPushNotificationsEnabled?: boolean;

  @Prop({ isNaN: true })
  isAppointmentsReminderEnabled?: boolean;

  @Prop({ isNaN: true })
  isRecommendationsEnabled?: boolean;

  @Prop({ isNaN: true })
  externalUserId?: string;

  @Prop()
  firstLoggedInAt?: Date;

  @Prop()
  honorific?: Honorific;

  @Prop()
  zipCode?: string;

  @Prop()
  language?: Language;

  /**
   * User only fields
   */
  @Prop()
  avatar?: string;
}

/**************************************************************************************************
 **************************************** Exported Schemas ****************************************
 *************************************************************************************************/
export type ClientSettingsDocument = ClientSettings & Document;
export const ClientSettingsDto = SchemaFactory.createForClass(ClientSettings);
