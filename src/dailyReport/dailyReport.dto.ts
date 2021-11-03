import { Field, InputType, Int, ObjectType, registerEnumType } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ErrorType, Errors, IsStringDate } from '../common';

/**************************************************************************************************
 ********************************** Input params for gql methods **********************************
 *************************************************************************************************/
export enum DailyReportCategoryTypes {
  Pain = 'Pain',
  Mood = 'Mood',
  Sleep = 'Sleep',
  Mobility = 'Mobility',
  Appetite = 'Appetite',
  Energy = 'Energy',
}

registerEnumType(DailyReportCategoryTypes, { name: 'DailyReportCategoryTypes' });

@InputType()
export class DailyReportCategoriesInput {
  @Field()
  memberId: string;

  @Field()
  @IsStringDate({ message: Errors.get(ErrorType.dailyReportMutationDateInvalid) })
  date: string;

  @Field(() => [DailyReportCategories])
  categories: DailyReportCategories[];
}

@InputType()
export class DailyReportQueryInput {
  @Field()
  memberId: string;

  @Field()
  @IsStringDate({ message: Errors.get(ErrorType.dailyReportQueryDateInvalid) })
  startDate: string;

  @Field()
  @IsStringDate({ message: Errors.get(ErrorType.dailyReportQueryDateInvalid) })
  endDate: string;
}
@InputType()
export class DailyReportCategories {
  @Prop(() => String)
  @Field(() => DailyReportCategoryTypes)
  category: DailyReportCategoryTypes;

  @Prop(() => Number)
  @Field(() => Int)
  rank: number;
}
/**************************************************************************************************
 ********************************* Return params for gql methods **********************************
 *************************************************************************************************/

@ObjectType()
@Schema({ versionKey: false, timestamps: true })
export class DailyReport {
  @Prop({ index: true, type: Types.ObjectId })
  @Field(() => String)
  memberId: Types.ObjectId;

  @Prop()
  @Field()
  date: string;

  @Prop(() => [DailyReportCategory])
  @Field(() => [DailyReportCategory])
  categories: DailyReportCategory[];

  @Prop(() => Boolean)
  notificationSent?: boolean;

  @Prop(() => [DailyReportCategoryTypes])
  @Field(() => [DailyReportCategoryTypes], { nullable: true })
  statsOverThreshold?: DailyReportCategoryTypes[];
}
@ObjectType()
export class DailyReportCategory {
  @Prop(() => String)
  @Field(() => DailyReportCategoryTypes)
  category: DailyReportCategoryTypes;

  @Prop(() => Number)
  @Field(() => Int)
  rank: number;
}
@ObjectType()
export class Metadata {
  @Field({ nullable: true })
  minDate?: string;
}

@ObjectType()
export class DailyReportResults {
  @Field(() => [DailyReport])
  data: DailyReport[];
  @Field(() => Metadata, { nullable: true })
  metadata?: Metadata;
}

/**************************************************************************************************
 **************************************** Exported Schemas ****************************************
 *************************************************************************************************/
export type DailyReportDocument = DailyReport & Document;
export const DailyReportDto = SchemaFactory.createForClass(DailyReport).index(
  { memberId: 1, date: 1 },
  { unique: true },
);
