import { Document } from 'mongoose';
import { Schema, SchemaFactory } from '@nestjs/mongoose';
import { ObjectType } from '@nestjs/graphql';
import { Task } from '.';

/**************************************************************************************************
 ********************************* Return params for gql methods **********************************
 *************************************************************************************************/
@ObjectType()
@Schema({ versionKey: false, timestamps: true })
export class ActionItem extends Task {}

/**************************************************************************************************
 **************************************** Exported Schemas ****************************************
 *************************************************************************************************/
export type ActionItemDocument = ActionItem & Document;
export const ActionItemDto = SchemaFactory.createForClass(ActionItem);
