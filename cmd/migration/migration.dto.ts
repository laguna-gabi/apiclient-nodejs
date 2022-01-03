import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export const ErrorColoring = '\x1b[31m%s\x1b[0m';
export const InfoColoring = '\x1b[34m%s\x1b[0m';

export enum Command {
  up = 'up',
  down = 'down',
  status = 'status',
  create = 'create',
}

export type Item = {
  fileName: string;
  appliedAt: string;
};

@Schema({ versionKey: false, collection: 'changelog' })
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
