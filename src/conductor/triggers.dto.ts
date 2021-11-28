import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

/**************************************************************************************************
 ***************************************** Mongodb schemas ****************************************
 *************************************************************************************************/
@Schema({ versionKey: false, timestamps: true })
export class Trigger {
  @Prop({ index: true, unique: true })
  dispatchId: string;

  @Prop({ index: true, expiresAt: 0 })
  expiresAt: Date;
}

/**************************************************************************************************
 **************************************** Exported Schemas ****************************************
 *************************************************************************************************/
export type TriggerDocument = Trigger & Document;
export const TriggerDto = SchemaFactory.createForClass(Trigger);
