import { Field, InputType, ObjectType, registerEnumType } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import {
  ErrorType,
  Errors,
  Identifier,
  IsDuplicateCodeInItemList,
  IsMissingOptionsInChoiceTypeItem,
  ItemInterface,
  ItemType,
  OptionInterface,
} from '../common';

/**************************************************************************************************
 ******************************* Enum registration for gql methods ********************************
 *************************************************************************************************/

export enum QuestionnaireType {
  phq9 = 'phq9',
  gad7 = 'gad7',
  who5 = 'who5',
  nps = 'nps',
}

registerEnumType(QuestionnaireType, {
  name: 'QuestionnaireType',
  description: 'A list of questionnaire types',
  valuesMap: {
    phq9: { description: 'Patient Health Questionnaire 9' },
    gad7: { description: 'Generalized Anxiety Disorder 7' },
    who5: { description: 'World Health Organization 5 (well being index)' },
    nps: { description: 'Net Promoter Score' },
  },
});

registerEnumType(ItemType, {
  name: 'ItemType',
  description: 'A list of question types',
  valuesMap: {
    choice: { description: 'single choice' },
    date: { description: 'date' },
    text: { description: 'free (short) text' },
    group: { description: 'group of questions (no answer is expected for group items)' },
  },
});

/**************************************************************************************************
 ********************************** Input params for gql methods **********************************
 *************************************************************************************************/
@InputType()
export class CreateQuestionnaireParams {
  @Field(() => String)
  name: string;

  @Field(() => QuestionnaireType)
  type: QuestionnaireType;

  @IsMissingOptionsInChoiceTypeItem({
    message: Errors.get(ErrorType.questionnaireItemMissingOptionsCode),
  })
  @IsDuplicateCodeInItemList({ message: Errors.get(ErrorType.questionnaireItemsDuplicateCode) })
  @Field(() => [Item])
  items: Item[];
}

/**************************************************************************************************
 ********************************* Return params for gql methods **********************************
 *************************************************************************************************/
@ObjectType()
@Schema({ versionKey: false, timestamps: true })
export class Questionnaire extends Identifier {
  @Prop()
  @Field(() => String)
  name: string;

  @Prop()
  @Field(() => QuestionnaireType)
  type: QuestionnaireType;

  @Prop()
  @Field(() => Boolean)
  active: boolean;

  @Prop()
  @Field(() => [Item])
  items: Item[];
}

@InputType('ItemInput')
@ObjectType()
export class Item implements ItemInterface {
  @Prop()
  @Field(() => String)
  code: string;

  @Prop()
  @Field(() => String)
  name: string;

  @Prop()
  @Field(() => ItemType)
  type: ItemType;

  @Prop()
  @Field(() => Number)
  order: number;

  @Prop()
  @Field(() => Boolean)
  required: boolean;

  @Prop()
  @Field(() => [Option], { nullable: true })
  options?: Option[];

  @Prop()
  @Field(() => [Item], { nullable: true })
  items?: Item[];
}

@InputType('OptionInput')
@ObjectType()
export class Option implements OptionInterface {
  @Prop()
  @Field(() => String)
  name: string;

  @Prop()
  @Field(() => Number)
  value: number;
}

/**************************************************************************************************
 **************************************** Exported Schemas ****************************************
 *************************************************************************************************/
export type QuestionnaireDocument = Questionnaire & Document;
export const QuestionnaireDto = SchemaFactory.createForClass(Questionnaire);
