import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

/**************************************************************************************************
 ********************************** Input params for gql methods **********************************
 *************************************************************************************************/
@InputType('ScoresInput')
@ObjectType()
export class Scores {
  @Field(() => Number)
  adherence: number;

  @Field(() => String, { nullable: true })
  adherenceText?: string;

  @Field(() => Number)
  wellbeing: number;

  @Field(() => String, { nullable: true })
  wellbeingText?: string;
}

@InputType('NoteInput')
@ObjectType()
export class Note {
  @Field(() => String)
  key: string;

  @Field(() => String)
  value: string;
}

@InputType()
@ObjectType()
export class SetNotesParams {
  @Field(() => String)
  appointmentId: string;

  @Field(() => [Note])
  notes: Array<Note>;

  @Field(() => Scores)
  scores: Scores;
}

/**************************************************************************************************
 ********************************* Return params for gql methods **********************************
 *************************************************************************************************/
@InputType('NotesInput')
@ObjectType()
@Schema({ versionKey: false, timestamps: true })
export class Notes {
  @Prop()
  @Field(() => [Note])
  notes: Note[];

  @Prop()
  @Field(() => Scores)
  scores: Scores;
}

/**************************************************************************************************
 **************************************** Exported Schemas ****************************************
 *************************************************************************************************/
export type NotesDocument = Notes & Document;
export const NotesDto = SchemaFactory.createForClass(Notes);
