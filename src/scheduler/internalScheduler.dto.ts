import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { LeaderType } from '.';

@Schema({ versionKey: false, timestamps: true })
export class Scheduler {
  @Prop()
  id: string;

  @Prop({ isNaN: false })
  leaderType?: LeaderType;

  @Prop({ isNaN: false })
  updatedAt?: Date;
}

/**************************************************************************************************
 **************************************** Exported Schemas ****************************************
 *************************************************************************************************/
export type InternalSchedulerDocument = Scheduler & Document;
export const InternalSchedulerDto = SchemaFactory.createForClass(Scheduler);
