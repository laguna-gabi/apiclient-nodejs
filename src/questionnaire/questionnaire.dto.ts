import { Field, InputType, ObjectType, registerEnumType } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ArrayNotEmpty } from 'class-validator';
import { Document, Types } from 'mongoose';
import * as mongooseDelete from 'mongoose-delete';
import {
  ErrorType,
  Errors,
  Identifier,
  IsDuplicateCodeInItemList,
  IsMissingOptionsInChoiceTypeItem,
  IsMissingRangeInRangeTypeItem,
  IsObjectId,
  IsOverlappingRangeInSeverityLevelEntries,
  ItemInterface,
  ItemType,
  OptionInterface,
  RangeElementInterface,
  RangeInterface,
  SeverityLevelInterface,
} from '../common';
import { ISoftDelete, audit, useFactoryOptions } from '../db';

/**************************************************************************************************
 ******************************* Enum registration for gql methods ********************************
 *************************************************************************************************/

export enum QuestionnaireType {
  phq9 = 'phq9',
  gad7 = 'gad7',
  who5 = 'who5',
  nps = 'nps',
  lhp = 'lhp',
}

export const QuestionnaireAlerts: Map<QuestionnaireType, string> = new Map([
  [QuestionnaireType.phq9, 'Nearly Every Day'],
]);

registerEnumType(QuestionnaireType, {
  name: 'QuestionnaireType',
  description: 'A list of questionnaire types',
  valuesMap: {
    phq9: { description: 'Patient Health Questionnaire 9' },
    gad7: { description: 'Generalized Anxiety Disorder 7' },
    who5: { description: 'World Health Organization 5 (well being index)' },
    nps: { description: 'Net Promoter Score' },
    lhp: { description: 'Healthcare Persona' },
  },
});

export enum AlertConditionType {
  equal = 'equal',
  gte = 'gte',
  lte = 'lte',
}

registerEnumType(AlertConditionType, {
  name: 'AlertConditionType',
  description: 'A list of alert condition types',
  valuesMap: {
    equal: { description: 'Answer value equals to alert condition value will trigger an alert' },
    gte: {
      description:
        'Answer value greater than or equal to alert condition value will trigger an alert',
    },
    lte: {
      description:
        'Answer value lower than or equal to alert condition value will trigger an alert',
    },
  },
});

registerEnumType(ItemType, {
  name: 'ItemType',
  description: 'A list of question types',
  valuesMap: {
    choice: { description: 'single choice' },
    text: { description: 'free (short) text' },
    group: { description: 'group of questions (no answer is expected for group items)' },
  },
});

export enum HealthPersona {
  active = 'Active',
  passive = 'Passive',
  highEffort = 'High effort',
  complacent = 'Complacent',
}

registerEnumType(HealthPersona, { name: 'HealthPersona' });

/**************************************************************************************************
 ********************************** Input params for gql methods **********************************
 *************************************************************************************************/
@InputType()
export class CreateQuestionnaireParams {
  @Field(() => String)
  name: string;

  @Field(() => String)
  shortName: string;

  @Field(() => QuestionnaireType)
  type: QuestionnaireType;

  @IsMissingOptionsInChoiceTypeItem({
    message: Errors.get(ErrorType.questionnaireItemMissingOptionsCode),
  })
  @IsDuplicateCodeInItemList({ message: Errors.get(ErrorType.questionnaireItemsDuplicateCode) })
  @IsMissingRangeInRangeTypeItem({
    message: Errors.get(ErrorType.questionnaireItemMissingRangeCode),
  })
  @Field(() => [Item])
  items: Item[];

  @Field(() => Boolean)
  isAssignableToMember: boolean;

  @IsOverlappingRangeInSeverityLevelEntries({
    message: Errors.get(ErrorType.questionnaireSeverityLevelInvalidCode),
  })
  @Field(() => [SeverityLevel], { nullable: true })
  severityLevels?: SeverityLevel[];

  @Field(() => Number, { nullable: true })
  notificationScoreThreshold?: number;
}

@InputType()
export class SubmitQuestionnaireResponseParams {
  @IsObjectId({ message: Errors.get(ErrorType.questionnaireResponseInvalidQuestionnaireId) })
  @Field(() => String)
  questionnaireId: string;

  @IsObjectId({ message: Errors.get(ErrorType.memberIdInvalid) })
  @Field(() => String)
  memberId: string;

  @ArrayNotEmpty({
    message: Errors.get(ErrorType.questionnaireResponseInvalidResponseEmptyAnswerList),
  })
  @Field(() => [Answer])
  answers: Answer[];
}

/**************************************************************************************************
 ********************************* Return params for gql methods **********************************
 *************************************************************************************************/

@InputType('OptionInput')
@ObjectType()
export class Option implements OptionInterface {
  @Prop()
  @Field(() => String)
  label: string;

  @Prop()
  @Field(() => Number)
  value: number;
}

@InputType('RangeElementInput')
@ObjectType()
export class RangeElement implements RangeElementInterface {
  @Prop()
  @Field(() => Number)
  value: number;

  @Prop()
  @Field(() => String)
  label: string;
}

@InputType('RangeInput')
@ObjectType()
export class Range implements RangeInterface {
  @Prop()
  @Field(() => RangeElement)
  min: RangeElement;

  @Prop()
  @Field(() => RangeElement)
  max: RangeElement;
}

@InputType('SeverityLevelInput')
@ObjectType()
export class SeverityLevel implements SeverityLevelInterface {
  @Prop()
  @Field(() => Number)
  min: number;

  @Prop()
  @Field(() => Number)
  max: number;

  @Prop()
  @Field(() => String)
  label: string;
}

@ObjectType()
@Schema({ versionKey: false, timestamps: true })
export class Questionnaire extends Identifier {
  @Prop()
  @Field(() => String)
  name: string;

  @Prop()
  @Field(() => String)
  shortName: string;

  @Prop()
  @Field(() => QuestionnaireType)
  type: QuestionnaireType;

  @Prop()
  @Field(() => Boolean)
  active: boolean;

  @Prop()
  @Field(() => [Item])
  items: Item[];

  @Prop()
  @Field(() => Boolean)
  isAssignableToMember: boolean;

  @Prop()
  @Field(() => [SeverityLevel], { nullable: true })
  severityLevels: SeverityLevel[];

  @Prop(() => Number)
  @Field(() => Number, { nullable: true })
  notificationScoreThreshold?: number;

  @Field(() => String, { nullable: true })
  createdBy?: Types.ObjectId;
}

@ObjectType()
export class QuestionnaireResponseResult {
  @Prop()
  @Field(() => Number, { nullable: true })
  score?: number;

  @Prop()
  @Field(() => String, { nullable: true })
  severity?: string;

  @Prop()
  @Field(() => Boolean, { nullable: true })
  alert?: boolean;
}

@ObjectType()
@Schema({ versionKey: false, timestamps: true })
export class QuestionnaireResponse extends Identifier {
  @Prop()
  @Field(() => String)
  questionnaireId: Types.ObjectId;

  @Prop()
  @Field(() => String)
  memberId: Types.ObjectId;

  @Prop()
  @Field(() => [Answer])
  answers: Answer[];

  @Field(() => QuestionnaireResponseResult, { nullable: true })
  result?: QuestionnaireResponseResult;

  @Field(() => QuestionnaireType)
  type?: QuestionnaireType;

  @Field(() => Date)
  createdAt: Date;

  @Field(() => String)
  createdBy: Types.ObjectId;
}

@InputType('ItemInput')
@ObjectType()
export class Item implements ItemInterface {
  @Prop()
  @Field(() => String)
  code: string;

  @Prop()
  @Field(() => String)
  label: string;

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
  @Field(() => Range, { nullable: true })
  range?: Range;

  @Prop()
  @Field(() => [Item], { nullable: true })
  items?: Item[];

  @Prop()
  @Field(() => [AlertCondition], { nullable: true })
  alertCondition?: AlertCondition[];
}

@InputType('AlertConditionInput')
@ObjectType()
export class AlertCondition {
  @Prop()
  @Field(() => AlertConditionType)
  type: AlertConditionType;

  @Prop()
  @Field(() => String)
  value: string;
}

@InputType('AnswerInput')
@ObjectType()
export class Answer {
  @Prop()
  @Field(() => String)
  code: string;

  @Prop()
  @Field(() => String)
  value: string;
}

/**************************************************************************************************
 **************************************** Exported Schemas ****************************************
 *************************************************************************************************/

export type QuestionnaireDocument = Questionnaire & Document;
export const QuestionnaireDto = audit(SchemaFactory.createForClass(Questionnaire));

export type QuestionnaireResponseDocument = QuestionnaireResponse &
  Document &
  ISoftDelete<QuestionnaireResponseDocument>;
export const QuestionnaireResponseDto = audit(
  SchemaFactory.createForClass(QuestionnaireResponse).plugin(mongooseDelete, useFactoryOptions),
);
