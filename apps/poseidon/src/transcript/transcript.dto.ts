import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({ versionKey: false, timestamps: true })
export class Transcript {
  @Prop({ index: true, unique: true })
  recordingId: string;

  @Prop()
  memberId: string;

  @Prop()
  userId: string;
}

/**************************************************************************************************
 **************************************** Exported Schemas ****************************************
 *************************************************************************************************/
export type TranscriptDocument = Transcript & Document;
export const TranscriptDto = SchemaFactory.createForClass(Transcript);
