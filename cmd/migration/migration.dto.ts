import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type Item = {
  fileName: string;
  appliedAt: string;
};

@Schema({ collection: 'changelog' })
export class Changelog {
  @Prop()
  fileName?: string;
  @Prop()
  appliedAt?: Date;
}

/**************************************************************************************************
 **************************************** Exported Schemas ****************************************
 *************************************************************************************************/
export type ChangelogDocument = Changelog & Document;
export const ChangelogDto = SchemaFactory.createForClass(Changelog);
