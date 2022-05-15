import { ItemType, OptionInterface } from '../../src/common';
import {
  AlertConditionType,
  CreateQuestionnaireParams,
  Item,
  QuestionnaireType,
} from '../../src/questionnaire';
import { upperCase } from 'lodash';

export const buildGAD7Questionnaire = (): CreateQuestionnaireParams => {
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
    required: false,
    options,
  }));

  return {
    name: `Generalized Anxiety Disorder 7`,
    shortName: 'GAD-7',
    type: QuestionnaireType.gad7,
    items: [
      {
        code: 'g1',
        label: groupTitle,
        type: ItemType.group,
        order: 0,
        required: false,
        items: groupItems,
      },
    ],
    isAssignableToMember: true,
    severityLevels: [
      { min: 0, max: 4, label: 'Minimal Anxiety' },
      { min: 5, max: 9, label: 'Mild Anxiety' },
      { min: 10, max: 14, label: 'Moderate Anxiety' },
      { min: 15, max: 21, label: 'Severe Anxiety' },
    ],
    notificationScoreThreshold: 6,
  };
};

export const buildPHQ9Questionnaire = (): CreateQuestionnaireParams => {
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
    'Feeling bad about yourself — ' +
      'or that you are a failure or have let yourself or your family down',
    'Trouble concentrating on things, such as reading the newspaper or watching television',
    'Moving or speaking so slowly that other people could have noticed? Or the opposite — ' +
      'being so fidgety or restless that you have been moving around a lot more than usual',
    'Thoughts that you would be better off dead or of hurting yourself in some way',
  ];

  let count = 0;
  const groupItems: Item[] = questions.map((question) => ({
    code: `q${++count}`,
    label: question,
    type: ItemType.choice,
    order: count,
    required: false,
    alertCondition:
      question === 'Thoughts that you would be better off dead or of hurting yourself in some way'
        ? [{ type: AlertConditionType.equal, value: '3' }]
        : undefined,
    options,
  }));

  return {
    name: `Patient Health Questionnaire 9`,
    shortName: 'PHQ-9',
    type: QuestionnaireType.phq9,
    items: [
      {
        code: 'g1',
        label: groupTitle,
        type: ItemType.group,
        order: 0,
        required: false,
        items: groupItems,
      },
    ],
    isAssignableToMember: true,
    severityLevels: [
      { min: 0, max: 0, label: 'No Depression' },
      { min: 1, max: 4, label: 'Minimal Depression' },
      { min: 5, max: 9, label: 'Mild Depression' },
      { min: 10, max: 14, label: 'Moderate Depression' },
      { min: 15, max: 19, label: 'Moderately Severe Depression' },
      { min: 20, max: 29, label: 'Severe Depression' },
    ],
    notificationScoreThreshold: 10,
  };
};

export const buildWHO5Questionnaire = (): CreateQuestionnaireParams => {
  const groupTitle =
    'Please respond to each item by selecting one answer ' +
    'per row regarding how you felt in the last two weeks.';

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
    required: false,
    options,
  }));

  return {
    name: `World Health Organization 5`,
    shortName: 'WHO-5',
    type: QuestionnaireType.who5,
    items: [
      {
        code: 'g1',
        label: groupTitle,
        type: ItemType.group,
        order: 0,
        required: false,
        items: groupItems,
      },
    ],
    isAssignableToMember: true,
  };
};

export const buildNPSQuestionnaire = (): CreateQuestionnaireParams => {
  return {
    name: `Net Promoter Score`,
    shortName: 'NPS',
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
    isAssignableToMember: true,
    severityLevels: [
      { min: 0, max: 6, label: 'Detractor' },
      { min: 7, max: 8, label: 'Passive' },
      { min: 9, max: 10, label: 'Promoter' },
    ],
  };
};

export const buildLHPQuestionnaire = (): CreateQuestionnaireParams => {
  /* eslint-disable max-len */
  const question1 =
    'Skills: How confident are you in identifying when it is necessary to get medical care? (Not at all confident, Somewhat confident, Confident, Very Confident)';
  const question2 =
    "Motivation: How often do you bring a written or mental list of questions to your doctors' visits? (Never, Sometimes, Usually, Always)";
  /* eslint-enable max-len */

  const options1: OptionInterface[] = [
    { label: 'Not at all confident', value: 1 },
    { label: 'Somewhat confident', value: 2 },
    { label: 'Confident', value: 3 },
    { label: 'Very confident', value: 4 },
  ];

  const options2: OptionInterface[] = [
    { label: 'Never', value: 1 },
    { label: 'Sometimes', value: 2 },
    { label: 'Usually', value: 3 },
    { label: 'Always', value: 4 },
  ];

  const groupItems: Item[] = [
    {
      code: `q1`,
      label: question1,
      type: ItemType.choice,
      order: 1,
      required: true,
      options: options1,
    },
    {
      code: `q2`,
      label: question2,
      type: ItemType.choice,
      order: 2,
      required: true,
      options: options2,
    },
  ];

  return {
    name: `Member Persona`,
    shortName: upperCase(QuestionnaireType.lhp),
    type: QuestionnaireType.lhp,
    items: groupItems,
    isAssignableToMember: false,
  };
};

export const buildCSATQuestionnaire = (): CreateQuestionnaireParams => {
  return {
    name: `Customer Satisfaction`,
    shortName: upperCase(QuestionnaireType.csat),
    type: QuestionnaireType.csat,
    items: [
      {
        code: `q1`,
        label: 'How would you rate your overall satisfaction with the experience you received?',
        type: ItemType.choice,
        order: 1,
        required: true,
        options: [
          { label: 'Very unsatisfied', value: 1 },
          { label: 'Unsatisfied', value: 2 },
          { label: 'Neutral', value: 3 },
          { label: 'Satisfied', value: 4 },
          { label: 'Very satisfied', value: 5 },
        ],
      },
    ],
    isAssignableToMember: true,
  };
};
