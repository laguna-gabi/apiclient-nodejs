import { ItemType, OptionInterface } from '../../src/common';
import {
  AlertConditionType,
  CreateQuestionnaireParams,
  Item,
  QuestionnaireType,
} from '../../src/questionnaire';
import { capitalize, upperCase } from 'lodash';
import { DailyReportCategoryTypes } from '../../src/dailyReport';

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
    buildResult: true,
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
    buildResult: true,
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
    severityLevels: [
      { min: 0, max: 51, label: 'poor well-being' },
      { min: 52, max: 100, label: 'good well-being' },
    ],
    notificationScoreThreshold: 51,
    notificationScoreThresholdReverse: true,
    scoreFactor: 4,
    buildResult: true,
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
    buildResult: true,
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
    buildResult: true,
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

export const buildDailyLogQuestionnaire = (): CreateQuestionnaireParams => {
  const questionEntries: { question: string; lowLabel: string; highLabel: string; code: string }[] =
    [
      {
        question: `How is the member's mood?`,
        lowLabel: 'bad',
        highLabel: 'great',
        code: DailyReportCategoryTypes.Mood,
      },
      {
        question: `How was the member's sleep last night?`,
        lowLabel: 'bad',
        highLabel: 'great',
        code: DailyReportCategoryTypes.Sleep,
      },
      {
        question: `What is the member's mobility level?`,
        lowLabel: 'low',
        highLabel: 'high',
        code: DailyReportCategoryTypes.Mobility,
      },
      {
        question: `How is the member's appetite?`,
        lowLabel: 'bad',
        highLabel: 'great',
        code: DailyReportCategoryTypes.Appetite,
      },
      {
        question: `What is the member's energy level?`,
        lowLabel: 'low',
        highLabel: 'high',
        code: DailyReportCategoryTypes.Energy,
      },
      {
        question: `How was the member's pain level?`,
        lowLabel: 'very painful',
        highLabel: 'no pain',
        code: DailyReportCategoryTypes.Pain,
      },
    ];

  let count = 0;
  const groupItems: Item[] = questionEntries.map((questionEntry) => ({
    code: `g${capitalize(questionEntry.code)}`,
    label: capitalize(questionEntry.code),
    type: ItemType.group,
    order: count++,
    required: false,
    items: [
      {
        code: questionEntry.code,
        label: questionEntry.question,
        type: ItemType.choice,
        order: count++,
        required: false,
        options: [
          { label: questionEntry.lowLabel, value: 1 },
          { label: '', value: 2 },
          { label: '', value: 3 },
          { label: '', value: 4 },
          { label: questionEntry.highLabel, value: 5 },
        ],
      },
    ],
  }));

  return {
    name: `Member Daily Log`,
    shortName: upperCase(QuestionnaireType.mdl),
    type: QuestionnaireType.mdl,
    items: groupItems,
    isAssignableToMember: false,
  };
};

export const buildCAGEQuestionnaire = (): CreateQuestionnaireParams => {
  const questions = [
    'Have you ever felt you ought to cut down on your drinking or drug use?',
    'Have people annoyed you by criticizing your drinking or drug use?',
    'Have you felt bad or guilty about your drinking or drug use?',
    // eslint-disable-next-line max-len
    'Have you ever had a drink or used drugs first thing in the morning to steady your nerves or to get rid of a hangover (eye-opener)?',
  ];

  let count = 0;
  const cageItems: Item[] = questions.map((question) => ({
    code: `q${++count}`,
    label: question,
    type: ItemType.choice,
    order: count,
    required: false,
    options: [
      { label: 'YES', value: 1 },
      { label: 'NO', value: 0 },
    ],
  }));

  return {
    name: `Cut, Annoyed, Guilty, and Eye`,
    shortName: upperCase(QuestionnaireType.cage),
    type: QuestionnaireType.cage,
    items: cageItems,
    isAssignableToMember: false,
    severityLevels: [{ min: 2, max: 4, label: 'Substance Abuse' }],
    buildResult: true,
  };
};

export const buildReadinessToChangeQuestionnaire = (): CreateQuestionnaireParams => {
  const questions = [
    'It’s a waste of time thinking about my drinking because I do not have a problem.',
    'I enjoy my drinking but sometimes I drink too much.',
    'There is nothing seriously wrong with my drinking.',
    'Sometimes I think I should quit or cut down on my drinking.',
    'Anyone can talk about wanting to do something about their drinking, ' +
      'but I’m actually doing something about it.',
    'I am a fairly normal drinker.',
    'My drinking is a problem sometimes.',
    'I am actually changing my drinking habits right now (either cutting down or quitting).',
    'I have started to carry out a plan to cut down or quit drinking.',
    'There is nothing I really need to change about my drinking.',
    'Sometimes I wonder if my drinking is out of control',
    'I am actively working on my drinking problem.',
  ];

  let count = 0;
  const rcqtvItems: Item[] = questions.map((question) => ({
    code: `q${++count}`,
    label: question,
    type: ItemType.choice,
    order: count,
    required: false,
    options: [
      { label: 'Strongly disagree', value: -2 },
      { label: 'Disagree', value: -1 },
      { label: 'Unsure', value: 0 },
      { label: 'Agree', value: 1 },
      { label: 'Strongly agree', value: 2 },
    ],
    buildResult: true,
  }));

  return {
    name: `Readiness to Change Questionnaire - Treatment Version`,
    shortName: upperCase(QuestionnaireType.rcqtv),
    type: QuestionnaireType.rcqtv,
    items: rcqtvItems,
    isAssignableToMember: false,
    buildResult: true,
  };
};

export const buildSDOHQuestionnaire = (): CreateQuestionnaireParams => {
  const safetyGroupOptions = [
    { label: 'Never', value: 1 },
    { label: 'Rarely', value: 2 },
    { label: 'Sometimes', value: 3 },
    { label: 'Fairly often', value: 4 },
    { label: 'Frequently', value: 5 },
  ];
  const substanceAbuseOptions = [
    { label: 'Never', value: 1 },
    { label: 'Once or Twice', value: 2 },
    { label: 'Monthly', value: 3 },
    { label: 'Weekly', value: 4 },
    { label: 'Daily or Almost Daily', value: 5 },
  ];
  const yesNoOptions = [
    { label: 'Yes', value: 0 },
    { label: 'No', value: 1 },
  ];

  return {
    name: `Social Determinants of Health`,
    shortName: upperCase(QuestionnaireType.sdoh),
    type: QuestionnaireType.sdoh,
    items: [
      {
        type: ItemType.group,
        code: 'LivingSituation',
        label: 'Living Situation',
        order: 1,
        items: [
          {
            type: ItemType.choice,
            code: 'q1',
            label: 'What is your living situation today?',
            options: [
              { label: 'I have a steady place to live', value: 0 },
              {
                label:
                  'I have a place to live today, but I am worried about losing it in the future',
                value: 1,
              },
              {
                label:
                  'I do not have a steady place to live (I am temporarily staying with others, ' +
                  'in a hotel, in a shelter, living outside on the street, on a beach, in a car, ' +
                  'abandoned building, bus or train station, or in a park',
                value: 2,
              },
            ],
            required: false,
            order: 2,
          },
          {
            type: ItemType.multiChoice,
            code: 'q2',
            label:
              'Think about the place you live. Do you have problems with ' +
              'any of the following? CHOOSE ALL THAT APPLY',
            options: [
              { label: 'Pests such as bugs, ants, or mice', value: 0 },
              { label: 'Mold', value: 1 },
              { label: 'Lead paint or pipes', value: 2 },
              { label: 'Lack of heat', value: 3 },
              { label: 'Oven or stove not working', value: 4 },
              { label: 'Smoke detectors missing or not working', value: 5 },
              { label: 'Water leaks', value: 6 },
              { label: 'None of the above', value: 7 },
            ],
            required: false,
            order: 3,
          },
        ],
        required: false,
      },
      {
        type: ItemType.group,
        code: 'Transportation',
        label: 'Transportation',
        order: 4,
        items: [
          {
            type: ItemType.choice,
            code: 'q3',
            label:
              'In the past 12 months, has lack of reliable transportation kept you from medical ' +
              'appointments, meetings, work or from getting things needed for daily living?',
            options: yesNoOptions,
            required: false,
            order: 5,
          },
        ],
        required: false,
      },
      {
        type: ItemType.group,
        code: 'Safety',
        label: 'Safety',
        order: 6,
        items: [
          {
            type: ItemType.choice,
            code: 'q4',
            label: 'How often does anyone, including family and friends, physically hurt you?',
            options: safetyGroupOptions,
            required: false,
            order: 7,
          },
          {
            type: ItemType.choice,
            code: 'q5',
            label:
              'How often does anyone, including family and friends, insult or talk down to you?',
            options: safetyGroupOptions,
            required: false,
            order: 8,
          },
          {
            type: ItemType.choice,
            code: 'q6',
            label: 'How often does anyone, including family and friends, threaten you with harm?',
            options: safetyGroupOptions,
            required: false,
            order: 9,
          },
          {
            type: ItemType.choice,
            code: 'q7',
            label: 'How often does anyone, including family and friends, scream or curse at you?',
            options: safetyGroupOptions,
            required: false,
            order: 10,
          },
        ],
        required: false,
      },
      {
        type: ItemType.group,
        code: 'FamilyAndCommunitySupport',
        label: 'Family and Community Support',
        order: 11,
        items: [
          {
            type: ItemType.choice,
            code: 'q8',
            label:
              'If for any reason you need help with day-to-day activities such as bathing, ' +
              'preparing meals, shopping, managing finances, etc., do you get the help you need?',
            options: [
              { label: 'I don’t need any help', value: 0 },
              { label: 'I get all the help I need', value: 1 },
              { label: 'I could use a little more help', value: 2 },
              { label: 'I need a lot more help', value: 3 },
            ],
            required: false,
            order: 12,
          },
          {
            type: ItemType.choice,
            code: 'q9',
            label: 'How often do you feel lonely or isolated from those around you?',
            options: [
              { label: 'Never', value: 0 },
              { label: 'Rarely', value: 1 },
              { label: 'Sometimes', value: 2 },
              { label: 'Often', value: 3 },
              { label: 'Always', value: 4 },
            ],
            required: false,
            order: 13,
          },
        ],
        required: false,
      },
      {
        type: ItemType.group,
        code: 'PhysicalActivity',
        label: 'Physical Activity',
        order: 14,
        items: [
          {
            type: ItemType.choice,
            code: 'q10',
            label:
              'In the last 30 days prior to your hospital stay (if applicable), other than the ' +
              'activities you did for work, on average, how many days per week did you engage in ' +
              'moderate exercise (like walking fast, running, jogging, dancing, swimming, biking ' +
              ',or other similar activities)?',
            options: [
              { label: '0', value: 0 },
              { label: '1', value: 1 },
              { label: '2', value: 2 },
              { label: '3', value: 3 },
              { label: '4', value: 4 },
              { label: '5', value: 5 },
              { label: '6', value: 6 },
              { label: '7', value: 7 },
            ],
            required: false,
            order: 15,
          },
          {
            type: ItemType.choice,
            code: 'q11',
            label:
              'On average, how many minutes did you usually spend exercising at this level on ' +
              'one of those days?',
            options: [
              { label: '0', value: 0 },
              { label: '10', value: 10 },
              { label: '20', value: 20 },
              { label: '30', value: 30 },
              { label: '40', value: 40 },
              { label: '50', value: 50 },
              { label: '60', value: 60 },
              { label: '90', value: 90 },
              { label: '120', value: 120 },
              { label: '150 or greater', value: 150 },
            ],
            required: false,
            order: 16,
          },
        ],
        required: false,
      },
      {
        type: ItemType.group,
        code: 'SubstanceAbuse',
        label: 'Substance Abuse',
        order: 17,
        items: [
          {
            type: ItemType.choice,
            code: 'q12',
            label:
              'How many times in the past 12 months have you had 5 or more drinks in a day ' +
              '(males) or 4 or more drinks in a day (females)?' +
              '\n(One drink is 12 ounces of beer, 5 ounces of wine, ' +
              'or 1.5 ounces of 80-proof spirits)',
            options: substanceAbuseOptions,
            required: false,
            order: 18,
          },
          {
            type: ItemType.choice,
            code: 'q13',
            label:
              'How many times in the past 12 months have you used tobacco products ' +
              '(like cigarettes, cigars, snuff, chew, electronic cigarettes)?',
            options: substanceAbuseOptions,
            required: false,
            order: 19,
          },
          {
            type: ItemType.choice,
            code: 'q14',
            label:
              'How many times in the past year have you used prescription drugs ' +
              'for non-medical reasons?',
            options: substanceAbuseOptions,
            required: false,
            order: 20,
          },
          {
            type: ItemType.choice,
            code: 'q15',
            label: 'How many times in the past year have you used marijuana?',
            options: substanceAbuseOptions,
            required: false,
            order: 21,
          },
          {
            type: ItemType.choice,
            code: 'q16',
            label: 'How many times in the past year have you used illegal drugs?',
            options: substanceAbuseOptions,
            required: false,
            order: 22,
          },
        ],
        required: false,
      },
      {
        type: ItemType.group,
        code: 'FunctionalStatus',
        label: 'Functional Status',
        order: 23,
        items: [
          {
            type: ItemType.choice,
            code: 'q17',
            label:
              'Because of a physical, mental, or emotional condition, do you have serious ' +
              'difficulty concentrating, remembering, or making decisions?',
            options: yesNoOptions,
            required: false,
            order: 24,
          },
          {
            type: ItemType.choice,
            code: 'q18',
            label:
              'Because of a physical, mental, or emotional condition, do you have difficulty ' +
              "doing errands alone such as visiting a doctor's office or shopping?",
            options: yesNoOptions,
            required: false,
            order: 25,
          },
        ],
        required: false,
      },
      {
        type: ItemType.group,
        code: 'EnglishProficiency',
        label: 'English Proficiency',
        order: 26,
        items: [
          {
            type: ItemType.choice,
            code: 'q19',
            label: 'What language are you most comfortable speaking?',
            options: [
              { label: 'English', value: 0 },
              { label: 'Language other than English', value: 1 },
              { label: 'I choose not to answer this question', value: 2 },
            ],
            required: false,
            order: 27,
          },
        ],
        required: false,
      },
    ],
    isAssignableToMember: false,
    buildResult: true,
  };
};
