import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Questionnaire, QuestionnaireDto, QuestionnaireResolver, QuestionnaireService } from '.';
import { CommonModule } from '../common';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Questionnaire.name, schema: QuestionnaireDto }]),
    CommonModule,
  ],
  providers: [QuestionnaireResolver, QuestionnaireService],
  exports: [QuestionnaireService],
})
export class QuestionnaireModule {}
