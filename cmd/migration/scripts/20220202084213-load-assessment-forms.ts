/* eslint-disable max-len */
import { Command } from '../.';
import * as path from 'path';
import { InfoColoring } from '../.';
import { Db } from 'mongodb';
import { AppModule } from '../../../src/app.module';
import { NestFactory } from '@nestjs/core';
import {
  CreateQuestionnaireParams,
  Item,
  QuestionnaireService,
  QuestionnaireType,
} from '../../../src/questionnaire';
import { ItemType, OptionInterface } from '../../../src/common';
// ------------------------------------------------------------------------------------------------
// Description: migrate `up`
// ------------------------------------------------------------------------------------------------
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const up = async (dryRun: boolean, db: Db) => {
  console.info(
    InfoColoring,
    `(${path.basename(__filename)}) migrating ${Command.up} ${dryRun ? 'in dry run mode' : ''}`,
  );
  // Note! if dry-run mode is applied the changelog will NOT get updated.

  //------------------------------------------------------------------------------------------------
  // migration (up) code here...
  //------------------------------------------------------------------------------------------------
  const app = await NestFactory.createApplicationContext(AppModule);

  // get the Member model from the Nest factory
  const qService = app.get<QuestionnaireService>(QuestionnaireService);

  // GAD-7
  qService.create(buildGAD7Questionnaire());
  // PHQ-9
  qService.create(buildPHQ9Questionnaire());
  // WHO-5
  qService.create(buildWHO5Questionnaire());
  // NPS
  qService.create(buildNPSQuestionnaire());
};

// ------------------------------------------------------------------------------------------------
// Description: migrate `down`
// ------------------------------------------------------------------------------------------------
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const down = async (dryRun: boolean, db: Db) => {
  console.info(
    InfoColoring,
    `(${path.basename(__filename)}) migrating ${Command.down} ${dryRun ? 'in dry run mode' : ''}`,
  );
  // Note! if dry-run mode is applied the changelog will NOT get updated.

  //------------------------------------------------------------------------------------------------
  // migration (down) code here...
  //------------------------------------------------------------------------------------------------
  db.collection('questionnaires').drop();
};

//------------------------------------------------------------------------------------------------
// Helper functions
//------------------------------------------------------------------------------------------------
const buildGAD7Questionnaire = (): CreateQuestionnaireParams => {
  const groupTitle =
    'Over the last 2 weeks, how often have you been bothered by the following problems?';

  const options: OptionInterface[] = [
    { label: 'Not at all', value: 0 },
    { label: 'Several days', value: 1 },
    { label: 'More than half the days', value: 2 },
    { label: 'Nearly every day', value: 3 },
  ];

  const questions: string[] = [
    'Feeling nervous, anxious or on edge',
    'Not being able to stop or control worrying',
    'Worrying too much about different things',
    'Trouble relaxing',
    'Being so restless that it is hard to sit still',
    'Becoming easily annoyed or irritable',
    'Feeling afraid as if something awful might happen',
  ];

  let count = 0;
  const groupItems: Item[] = questions.map((question) => ({
    code: `q${++count}`,
    label: question,
    type: ItemType.choice,
    order: count,
    required: true,
    options,
  }));

  return {
    name: `Generalized Anxiety Disorder 7`,
    type: QuestionnaireType.gad7,
    items: [
      {
        code: 'g1',
        label: groupTitle,
        type: ItemType.group,
        order: 0,
        required: true,
        items: groupItems,
      },
    ],
    severityLevels: [
      { min: 0, max: 4, label: 'Minimal Anxiety' },
      { min: 5, max: 9, label: 'Mild Anxiety' },
      { min: 10, max: 14, label: 'Moderate Anxiety' },
      { min: 15, max: 21, label: 'Severe Anxiety' },
    ],
  };
};

const buildPHQ9Questionnaire = (): CreateQuestionnaireParams => {
  const groupTitle =
    'Over the last 2 weeks, how often have you been bothered by any of the following problems?';

  const options: OptionInterface[] = [
    { label: 'Not at all', value: 0 },
    { label: 'Several days', value: 1 },
    { label: 'More than half the days', value: 2 },
    { label: 'Nearly every day', value: 3 },
  ];

  const questions: string[] = [
    'Little interest or pleasure in doing things',
    'Feeling down, depressed, or hopeless',
    'Trouble falling or staying asleep, or sleeping too much',
    'Feeling tired or having little energy',
    'Poor appetite or overeating',
    'Feeling bad about yourself — or that you are a failure or have let yourself or your family down',
    'Trouble concentrating on things, such as reading the newspaper or watching television',
    'Moving or speaking so slowly that other people could have noticed? Or the opposite — being so fidgety or restless that you have been moving around a lot more than usual',
    'Thoughts that you would be better off dead or of hurting yourself in some way',
  ];

  let count = 0;
  const groupItems: Item[] = questions.map((question) => ({
    code: `q${++count}`,
    label: question,
    type: ItemType.choice,
    order: count,
    required: true,
    options,
  }));

  return {
    name: `Patient Health Questionnaire 9`,
    type: QuestionnaireType.phq9,
    items: [
      {
        code: 'g1',
        label: groupTitle,
        type: ItemType.group,
        order: 0,
        required: true,
        items: groupItems,
      },
    ],
    severityLevels: [
      { min: 0, max: 0, label: 'No Depression' },
      { min: 1, max: 4, label: 'Minimal Depression' },
      { min: 5, max: 9, label: 'Mild Depression' },
      { min: 10, max: 14, label: 'Moderate Depression' },
      { min: 15, max: 19, label: 'Moderately Severe Depression' },
      { min: 20, max: 29, label: 'Severe Depression' },
    ],
  };
};

const buildWHO5Questionnaire = (): CreateQuestionnaireParams => {
  const groupTitle =
    'Please respond to each item by marking one box per row, regarding how you felt in the last two weeks.';

  const options: OptionInterface[] = [
    { label: 'All the time', value: 5 },
    { label: 'Most of the time', value: 4 },
    { label: 'More than half the time', value: 3 },
    { label: 'Less than half the time', value: 2 },
    { label: 'Some of the time', value: 1 },
    { label: 'At no time', value: 0 },
  ];

  const questions: string[] = [
    'I have felt cheerful in good spirits.',
    'I have felt calm and relaxed.',
    'I have felt active and vigorous.',
    'I woke up feeling fresh and rested.',
    'My daily life has been filled with things that interest me.',
  ];

  let count = 0;
  const groupItems: Item[] = questions.map((question) => ({
    code: `q${++count}`,
    label: question,
    type: ItemType.choice,
    order: count,
    required: true,
    options,
  }));

  return {
    name: `World Health Organization 5`,
    type: QuestionnaireType.who5,
    items: [
      {
        code: 'g1',
        label: groupTitle,
        type: ItemType.group,
        order: 0,
        required: true,
        items: groupItems,
      },
    ],
  };
};

const buildNPSQuestionnaire = (): CreateQuestionnaireParams => {
  return {
    name: `Net Promoter Score`,
    type: QuestionnaireType.nps,
    items: [
      {
        code: 'q1',
        label: 'Thank you for using Laguna Health. How likely are you to recommend us to a friend?',
        type: ItemType.range,
        order: 0,
        required: true,
        range: { min: { value: 0, label: 'not likely' }, max: { value: 10, label: 'very likely' } },
      },
    ],
  };
};
