import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { useFactoryOptions } from '../db';
import {
  Questionnaire,
  QuestionnaireDto,
  QuestionnaireResolver,
  QuestionnaireResponse,
  QuestionnaireResponseDto,
  QuestionnaireService,
} from '.';
import { CommonModule } from '../common';
import * as mongooseDelete from 'mongoose-delete';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Questionnaire.name, schema: QuestionnaireDto }]),
    MongooseModule.forFeatureAsync([
      {
        name: QuestionnaireResponse.name,
        useFactory: () => {
          return QuestionnaireResponseDto.plugin(mongooseDelete, useFactoryOptions);
        },
      },
    ]),
    CommonModule,
  ],
  providers: [QuestionnaireResolver, QuestionnaireService],
  exports: [QuestionnaireService],
})
export class QuestionnaireModule {}
