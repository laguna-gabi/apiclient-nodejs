import { Field, InputType, Int, ObjectType, registerEnumType } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { IsOptional, Matches } from 'class-validator';
import { Document, Types } from 'mongoose';
import * as mongooseDelete from 'mongoose-delete';
import { ErrorType, Errors, onlyDateRegex } from '../common';
import { ISoftDelete, audit, useFactoryOptions } from '../db';
import { IsObjectId } from '@argus/hepiusClient';
import { DefaultSchemaOptions } from '@argus/pandora';

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
  // hidden field for GQL - populated from member auth token
  memberId?: string;
  journeyId?: string;

  @Field()
  @Matches(onlyDateRegex, { message: Errors.get(ErrorType.dailyReportMutationDateInvalid) })
  date: string;

  @Field(() => [DailyReportCategories])
  categories: DailyReportCategories[];
}

@InputType()
export class DailyReportQueryInput {
  @IsOptional()
  @Field({ nullable: true })
  @IsObjectId({ message: Errors.get(ErrorType.memberIdInvalid) })
  memberId?: string;

  journeyId?: string;

  @Field()
  @Matches(onlyDateRegex, { message: Errors.get(ErrorType.dailyReportQueryDateInvalid) })
  startDate: string;

  @Field()
  @Matches(onlyDateRegex, { message: Errors.get(ErrorType.dailyReportQueryDateInvalid) })
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
@Schema(DefaultSchemaOptions)
export class DailyReport {
  @Prop({ index: true, type: Types.ObjectId })
  @Field(() => String)
  memberId: Types.ObjectId;

  @Prop({ index: true, type: Types.ObjectId })
  @Field(() => String)
  journeyId: Types.ObjectId;

  @Prop({ index: true })
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
export type DailyReportDocument = DailyReport & Document & ISoftDelete<DailyReport>;
export const DailyReportDto = audit(
  SchemaFactory.createForClass(DailyReport)
    .index({ memberId: 1, date: 1 }, { unique: true })
    .plugin(mongooseDelete, useFactoryOptions),
);
