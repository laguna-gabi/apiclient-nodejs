import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Questionnaire,
  QuestionnaireDto,
  QuestionnaireResolver,
  QuestionnaireResponse,
  QuestionnaireResponseDto,
  QuestionnaireService,
} from '.';
import { CommonModule } from '../common';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Questionnaire.name, schema: QuestionnaireDto },
      { name: QuestionnaireResponse.name, schema: QuestionnaireResponseDto },
    ]),
    CommonModule,
  ],
  providers: [QuestionnaireResolver, QuestionnaireService],
  exports: [QuestionnaireService, MongooseModule],
})
export class QuestionnaireModule {}
