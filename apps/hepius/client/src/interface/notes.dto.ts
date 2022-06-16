import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Prop, Schema } from '@nestjs/mongoose';
import { DefaultSchemaOptions } from '@argus/pandora';

/**************************************************************************************************
 ********************************** Input params for gql methods **********************************
 *************************************************************************************************/
@InputType('ScoresInput')
@ObjectType()
@Schema()
export class Scores {
  @Prop({ isNaN: true })
  @Field(() => Number, { nullable: true })
  adherence?: number;

  @Prop({ isNaN: true })
  @Field(() => String, { nullable: true })
  adherenceText?: string;

  @Prop({ isNaN: true })
  @Field(() => Number, { nullable: true })
  wellbeing?: number;

  @Prop({ isNaN: true })
  @Field(() => String, { nullable: true })
  wellbeingText?: string;
}

/**************************************************************************************************
 ********************************* Return params for gql methods **********************************
 *************************************************************************************************/
@InputType('NotesInput')
@ObjectType()
@Schema(DefaultSchemaOptions)
export class Notes {
  @Prop({ isNaN: true })
  @Field(() => String, { nullable: true })
  recap?: string;

  @Prop({ isNaN: true })
  @Field(() => String, { nullable: true })
  strengths?: string;

  @Prop({ isNaN: true })
  @Field(() => String, { nullable: true })
  userActionItem?: string;

  @Prop({ isNaN: true })
  @Field(() => String, { nullable: true })
  memberActionItem?: string;

  @Prop({ isNan: true })
  @Field(() => Scores, { nullable: true })
  scores?: Scores;
}
