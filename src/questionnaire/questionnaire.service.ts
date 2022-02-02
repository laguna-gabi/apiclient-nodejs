import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateQuestionnaireParams, Questionnaire, QuestionnaireDocument } from '.';

@Injectable()
export class QuestionnaireService {
  constructor(
    @InjectModel(Questionnaire.name)
    private readonly questionnaire: Model<QuestionnaireDocument>,
  ) {}

  async create(createQuestionnaireParams: CreateQuestionnaireParams): Promise<Questionnaire> {
    // disable all previous versions of this type
    await this.questionnaire.updateMany(
      { type: createQuestionnaireParams.type, active: true },
      { $set: { active: false } },
    );

    return this.questionnaire.create({ ...createQuestionnaireParams, active: true });
  }

  async get(): Promise<Questionnaire[]> {
    return this.questionnaire.find({ active: true });
  }
}
