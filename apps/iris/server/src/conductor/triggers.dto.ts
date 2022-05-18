import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

/**************************************************************************************************
 ***************************************** Mongodb schemas ****************************************
 *************************************************************************************************/
@Schema({ versionKey: false, timestamps: true })
export class Trigger {
  @Prop()
  dispatchId: string;

  @Prop({ index: true, expires: 0 })
  expireAt: Date;
}

/**************************************************************************************************
 **************************************** Exported Schemas ****************************************
 *************************************************************************************************/
export type TriggerDocument = Trigger & Document;
export const TriggerDto = SchemaFactory.createForClass(Trigger);
