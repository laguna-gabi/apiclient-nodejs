import { Platform } from '@lagunahealth/pandora';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

/**************************************************************************************************
 ***************************************** Mongodb schemas ****************************************
 *************************************************************************************************/
@Schema({ versionKey: false, timestamps: true })
export class ClientSettings {
  @Prop({ index: true })
  id: string;

  @Prop({ isNaN: true })
  orgName?: string;

  @Prop({ isNaN: true })
  phone?: string;

  @Prop({ isNaN: true })
  platform?: Platform;

  @Prop({ isNaN: true })
  externalUserId?: string;

  @Prop({ isNaN: true })
  isPushNotificationsEnabled?: boolean;

  @Prop({ isNaN: true })
  isAppointmentsReminderEnabled?: boolean;
}

/**************************************************************************************************
 **************************************** Exported Schemas ****************************************
 *************************************************************************************************/
export type ClientSettingsDocument = ClientSettings & Document;
export const ClientSettingsDto = SchemaFactory.createForClass(ClientSettings);
