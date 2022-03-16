import { ObjectType } from '@nestjs/graphql';
import { Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { Task } from '.';
import { ISoftDelete, audit, useFactoryOptions } from '../db';
import * as mongooseDelete from 'mongoose-delete';

/**************************************************************************************************
 ********************************* Return params for gql methods **********************************
 *************************************************************************************************/
@ObjectType()
@Schema({ versionKey: false, timestamps: true })
export class ActionItem extends Task {}

/**************************************************************************************************
 **************************************** Exported Schemas ****************************************
 *************************************************************************************************/
export type ActionItemDocument = ActionItem & Document & ISoftDelete<ActionItem>;
export const ActionItemDto = audit(
  SchemaFactory.createForClass(ActionItem).plugin(mongooseDelete, useFactoryOptions),
);
