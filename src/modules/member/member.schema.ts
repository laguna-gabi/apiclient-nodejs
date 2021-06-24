import { Schema, SchemaFactory } from '@nestjs/mongoose';
import * as mongoose from 'mongoose';

export type MemberDocument = Member & mongoose.Document;

@Schema()
export class Member {}

export const MemberSchema = SchemaFactory.createForClass(Member);
