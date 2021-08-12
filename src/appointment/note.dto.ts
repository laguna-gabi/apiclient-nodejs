import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

/**************************************************************************************************
 ********************************** Input params for gql methods **********************************
 *************************************************************************************************/
@InputType('ScoresInput')
@ObjectType()
@Schema()
export class Scores {
  @Prop()
  @Field(() => Number)
  adherence: number;

  @Prop({ isNaN: true })
  @Field(() => String, { nullable: true })
  adherenceText?: string;

  @Prop()
  @Field(() => Number)
  wellbeing: number;

  @Prop({ isNaN: true })
  @Field(() => String, { nullable: true })
  wellbeingText?: string;
}

/**************************************************************************************************
 ********************************* Return params for gql methods **********************************
 *************************************************************************************************/
@InputType('NotesInput')
@ObjectType()
@Schema({ versionKey: false, timestamps: true })
export class Notes {
  @Prop()
  @Field(() => String)
  recap: string;

  @Prop()
  @Field(() => String)
  strengths: string;

  @Prop()
  @Field(() => String)
  userActionItem: string;

  @Prop()
  @Field(() => String)
  memberActionItem: string;

  @Prop()
  @Field(() => Scores)
  scores: Scores;
}

/**************************************************************************************************
 ********************************** Input params for gql methods **********************************
 *************************************************************************************************/
@InputType()
@ObjectType()
export class SetNotesParams extends Notes {
  @Field(() => String)
  appointmentId: string;
}

/**************************************************************************************************
 **************************************** Exported Schemas ****************************************
 *************************************************************************************************/
export type NotesDocument = Notes & Document;
export const NotesDto = SchemaFactory.createForClass(Notes);
