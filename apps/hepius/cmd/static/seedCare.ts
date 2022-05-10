/* eslint-disable max-len */

import { Model } from 'mongoose';
import { BarrierType, CarePlanType } from '@argus/hepiusClient';

export const seedCarePlans = [
  {
    description:
      'Address carefully, and not directly, break the subject into smaller pieces, help member develop plan B.',
    isCustom: false,
  },
  {
    description: 'Assist member in finding home delivery services',
    isCustom: false,
  },
  {
    description: 'Assist member in finding resources available from social services and food banks',
    isCustom: false,
  },
  {
    description: 'Assist member in getting proper DME through insurance or public assistance',
    isCustom: false,
  },
  {
    description: 'Assure home health or a family caregiver are available to help the member',
    isCustom: false,
  },
  {
    description: 'Assure home is ready for member’s return to the home',
    isCustom: false,
  },
  {
    description: 'Assure the member is safe in home environment',
    isCustom: false,
  },
  {
    description:
      'Check for friends, family, religious and community affiliations and use social services as needed',
    isCustom: false,
  },
  {
    description:
      'Clarify appointments - provide education/instructions the member understands, check for comprehension',
    isCustom: false,
  },
  {
    description:
      'Clarify recovery plan – provide education/instructions so the member understands what to do, check for comprehension',
    isCustom: false,
  },
  {
    description: 'Contact provider, arrange for home health/explore options for assistance',
    isCustom: false,
  },
  {
    description: 'Contact provider/services/insurance to get member access',
    isCustom: false,
  },
  {
    description: 'Create To-do’s to remind member of appointments',
    isCustom: false,
  },
  {
    description: 'Develop a mobility workaround',
    isCustom: false,
  },
  {
    description:
      'Discuss strategies to adjust schedule to accommodate responsibilities and enlist help of others',
    isCustom: false,
  },
  {
    description:
      'Discuss the conflict, normalize that caregiver conflict is common, and refer member to mental health professional for depression and anxiety',
    isCustom: false,
  },
  {
    description:
      'Empower member to take responsibility for their treatment by helping them understand what they have power over and what they don’t',
    isCustom: false,
  },
  {
    description:
      'Escalate to Laguna lead nurse to review parameters and BDPs and outline next steps',
    isCustom: false,
  },
  {
    description: 'Explore home health options with the member',
    isCustom: false,
  },
  {
    description:
      'Find out what the source of the miss trust is, help member articulate what they need from the provider to trust them, help member prepare for that discussion',
    isCustom: false,
  },
  {
    description: 'Help find public assistance',
    isCustom: false,
  },
  {
    description:
      'Help member accept the lack of caregiver emotional support and help them identify where they can get support',
    isCustom: false,
  },
  {
    description: 'Help member arrange for interpreter',
    isCustom: false,
  },
  {
    description: 'Help member check for available family support',
    isCustom: false,
  },
  {
    description: 'Help member connect with community resources and religious organizations',
    isCustom: false,
  },
  {
    description:
      'Help member explore how their support system can help them (family, religious community, friends)',
    isCustom: false,
  },
  {
    description: 'Help member learn how to use Uber/Lyft',
    isCustom: false,
  },
  {
    description: 'Help member plan their day with increased people interactions',
    isCustom: false,
  },
  {
    description: 'Help member understand their transportation benefits',
    isCustom: false,
  },
  {
    description: 'Help set up appointment with provider to discuss issue of fatigue',
    isCustom: false,
  },
  {
    description: 'Help set up appointment with provider to discuss issue of weakness',
    isCustom: false,
  },
  {
    description:
      'Help them identify their priorities: discuss what’s important to them, what are they comfortable with and help them decide what their priorities are',
    isCustom: false,
  },
  {
    description: 'Helping initiate the disability process if qualified',
    isCustom: false,
  },
  {
    description:
      'Helping reduce their overall household costs and prioritize spending on healthcare. Example: energy star program, help find lower cost options for everyday items, phone bills',
    isCustom: false,
  },
  {
    description:
      'Identify emotional motivators. Help member understand the implications of doing nothing. Identify and remove barriers',
    isCustom: false,
  },
  {
    description: 'Identify multiple emotional motivators and keep them tied to recovery goals',
    isCustom: false,
  },
  {
    description: 'Identify supportive caretakers and teach member how to ask for support',
    isCustom: false,
  },
  {
    description:
      'Make sure member has discussed w/provider, suggest pain management specialist, suggest mindfulness, meditation techniques',
    isCustom: false,
  },
  {
    description: 'Make sure member understands how to live day-to-day with biomedical challenges',
    isCustom: false,
  },
  {
    description: 'Medication copay, explore less costly options like generics or bioequivalent',
    isCustom: false,
  },
  {
    description:
      'Member has a complicated bereavement over loss of function, refer them to a mental health professional',
    isCustom: false,
  },
  {
    description:
      'Normalize that worry and sadness are common during a healthcare event, use empathic listening skills',
    isCustom: false,
  },
  {
    description: 'Provide education/instructions the member understands, check for comprehension',
    isCustom: false,
  },
  {
    description: 'Provide member with available services/resources/county services',
    isCustom: false,
  },
  {
    description: 'Refer member to a mental health professional, make sure to check their benefits',
    isCustom: false,
  },
  {
    description:
      'See if the treating facility where their appointments are has transportation services',
    isCustom: false,
  },
  {
    description: 'Support member in using technology to connect with family and friends',
    isCustom: false,
  },
  {
    description: 'Talk with member about the new normal to help them accept their lose',
    isCustom: false,
  },
  {
    description: 'Work with member to assure that they have an order in place and finances to pay',
    isCustom: false,
  },
  {
    description: 'Work with the member’s family to provide help to the member',
    isCustom: false,
  },
];

export const seedBarriers = [
  {
    description: 'Fatigue',
    domain: 'mobility',
    carePlanTypes: [
      'Help set up appointment with provider to discuss issue of fatigue',
      'Develop a mobility workaround',
    ],
  },
  {
    description: 'Weakness',
    domain: 'mobility',
    carePlanTypes: [
      'Help set up appointment with provider to discuss issue of weakness',
      'Develop a mobility workaround',
    ],
  },
  {
    description: 'Disability such as paralysis, neurological deficit, or injury',
    domain: 'mobility',
    carePlanTypes: ['Assure home health or a family caregiver are available to help the member'],
  },
  {
    description:
      'Lack of home preparation (ramps, rugs, bath and toilet rails, bed, fall prevention)',
    domain: 'environment',
    carePlanTypes: ['Assure home is ready for member’s return to the home'],
  },
  {
    description: 'Lack of needed assistance (paid caregivers, unpaid caregivers such as family)',
    domain: 'environment',
    carePlanTypes: [
      'Provide member with available services/resources/county services',
      'Work with the member’s family to provide help to the member',
    ],
  },
  {
    description:
      'Lack of proper Durable Medical Equipment (DME) and/or lack of education on use of DME',
    domain: 'environment',
    carePlanTypes: ['Assist member in getting proper DME through insurance or public assistance'],
  },
  {
    description: 'Proper nutrition access',
    domain: 'environment',
    carePlanTypes: [
      'Assist member in finding resources available from social services and food banks',
      'Assist member in finding home delivery services',
    ],
  },
  {
    description: 'Proper monitoring equipment',
    domain: 'environment',
    carePlanTypes: [
      'Work with member to assure that they have an order in place and finances to pay',
    ],
  },
  {
    description: 'Home safety',
    domain: 'environment',
    carePlanTypes: ['Assure the member is safe in home environment'],
  },
  {
    description: 'Medication confusion/unable to take as directed',
    domain: 'medical',
    carePlanTypes: [
      'Provide education/instructions the member understands, check for comprehension',
    ],
  },
  {
    description: 'Appointment follow up unclear',
    domain: 'medical',
    carePlanTypes: [
      'Clarify appointments - provide education/instructions the member understands, check for comprehension',
      'Create To-do’s to remind member of appointments',
    ],
  },
  {
    description: 'Access to recovery providers (PT, OT, home health for example)',
    domain: 'medical',
    carePlanTypes: ['Contact provider/services/insurance to get member access'],
  },
  {
    description: 'Lack of clear recovery plan or understanding of recovery plan',
    domain: 'medical',
    carePlanTypes: [
      'Clarify recovery plan – provide education/instructions so the member understands what to do, check for comprehension',
    ],
  },
  {
    description: 'Poor Health literacy and recovery plan literacy by patient and caregivers',
    domain: 'medical',
    carePlanTypes: [
      'Provide education/instructions the member understands, check for comprehension',
    ],
  },
  {
    description: 'Unable to manage Wound care',
    domain: 'medical',
    carePlanTypes: ['Contact provider, arrange for home health/explore options for assistance'],
  },
  {
    description: 'Poor pain management',
    domain: 'medical',
    carePlanTypes: [
      'Make sure member has discussed w/provider, suggest pain management specialist, suggest mindfulness, meditation techniques',
    ],
  },
  {
    description:
      'Intubation or catheterization/biomedical challenges (i.e., intubation, catheterization, amputation etc.)',
    domain: 'medical',
    carePlanTypes: [
      'Make sure member understands how to live day-to-day with biomedical challenges',
      'Explore home health options with the member',
    ],
  },
  {
    description: 'Lack of clear clinical parameters and thresholds for urgent medical interaction',
    domain: 'medical',
    carePlanTypes: [
      'Escalate to Laguna lead nurse to review parameters and BDPs and outline next steps',
    ],
  },
  {
    description: 'Readiness to change',
    domain: 'behavior',
    carePlanTypes: [
      'Identify emotional motivators. Help member understand the implications of doing nothing. Identify and remove barriers',
    ],
  },
  {
    description: 'Motivation',
    domain: 'behavior',
    carePlanTypes: ['Identify multiple emotional motivators and keep them tied to recovery goals'],
  },
  {
    description: 'Emotional support',
    domain: 'behavior',
    carePlanTypes: ['Identify supportive caretakers and teach member how to ask for support'],
  },
  {
    description: 'Loneliness',
    domain: 'behavior',
    carePlanTypes: [
      'Help member plan their day with increased people interactions',
      'Check for friends, family, religious and community affiliations and use social services as needed',
      'Support member in using technology to connect with family and friends',
    ],
  },
  {
    description: 'Financial – no $ for copays and non-covered items',
    domain: 'logistical',
    carePlanTypes: [
      'Helping reduce their overall household costs and prioritize spending on healthcare. Example: energy star program, help find lower cost options for everyday items, phone bills',
      'Medication copay, explore less costly options like generics or bioequivalent',
      'Help find public assistance',
      'Helping initiate the disability process if qualified',
    ],
  },
  {
    description: 'Familial – Cultural/spiritual biases learned at home',
    domain: 'logistical',
    carePlanTypes: [
      'Help them identify their priorities: discuss what’s important to them, what are they comfortable with and help them decide what their priorities are',
    ],
  },
  {
    description:
      'Competing Responsibilities – Time and effort (job, taking care of a family member)',
    domain: 'logistical',
    carePlanTypes: [
      'Discuss strategies to adjust schedule to accommodate responsibilities and enlist help of others',
    ],
  },
  {
    description: 'Transportation – travel to follow up appointments',
    domain: 'logistical',
    carePlanTypes: [
      'Help member explore how their support system can help them (family, religious community, friends)',
      'Help member understand their transportation benefits',
      'See if the treating facility where their appointments are has transportation services',
      'Help member learn how to use Uber/Lyft',
    ],
  },
  {
    description: 'Social support/Isolation',
    domain: 'logistical',
    carePlanTypes: ['Help member connect with community resources and religious organizations'],
  },
  {
    description: 'Language',
    domain: 'logistical',
    carePlanTypes: [
      'Help member check for available family support',
      'Help member arrange for interpreter',
    ],
  },
  {
    description:
      'Grief over loss of previous levels of functioning (i.e. 50% of cardiac cases and 75% of stroke cases can be expected to have a major depressive event)',
    domain: 'emotional',
    carePlanTypes: [
      'Talk with member about the new normal to help them accept their lose',
      'Member has a complicated bereavement over loss of function, refer them to a mental health professional',
    ],
  },
  {
    description:
      'Comorbid psychiatric conditions such as anxiety and depression, serious mental illness (SMI) and substance abuse disorder',
    domain: 'emotional',
    carePlanTypes: [
      'Refer member to a mental health professional, make sure to check their benefits',
    ],
  },
  {
    description: 'Natural worry and sadness connected with healthcare events',
    domain: 'emotional',
    carePlanTypes: [
      'Normalize that worry and sadness are common during a healthcare event, use empathic listening skills',
    ],
  },
  {
    description: 'Natural worry and sadness over recovery tasks',
    domain: 'emotional',
    carePlanTypes: [
      'Normalize that worry and sadness are common during a healthcare event, use empathic listening skills',
    ],
  },
  {
    description: 'Denial',
    domain: 'emotional',
    carePlanTypes: [
      'Address carefully, and not directly, break the subject into smaller pieces, help member develop plan B.',
    ],
  },
  {
    description: 'Locus of control',
    domain: 'emotional',
    carePlanTypes: [
      'Empower member to take responsibility for their treatment by helping them understand what they have power over and what they don’t',
    ],
  },
  {
    description: 'Caregiver conflicts leading to depression, anxiety and anger',
    domain: 'emotional',
    carePlanTypes: [
      'Discuss the conflict, normalize that caregiver conflict is common, and refer member to mental health professional for depression and anxiety',
    ],
  },
  {
    description: 'Lack of caregiver emotional support',
    domain: 'emotional',
    carePlanTypes: [
      'Help member accept the lack of caregiver emotional support and help them identify where they can get support',
    ],
  },
  {
    description: 'Lack of trust towards healthcare provider/healthcare system',
    domain: 'emotional',
    carePlanTypes: [
      'Find out what the source of the miss trust is, help member articulate what they need from the provider to trust them, help member prepare for that discussion',
    ],
  },
];

export const seedRedFlags = [
  {
    description: 'Uncontrolled chronic condition (high A1C, high sugars, high BP)',
  },
  {
    description: 'Appointment adherence (missed appts/unable to schedule appts)',
  },
  {
    description: 'Resource utilization (trips to ER, requesting unnecessary tests/procedures)',
  },
  {
    description: 'Medication adherence (missed/not taking meds, unable to order meds)',
  },
  {
    description:
      'Plan of care (POC) Adherence (not following previous plan of care/recommendations)',
  },
  {
    description: 'Significant weight loss/gain (+10 lbs.)',
  },
  {
    description: 'Knowledge of health or health care status (unaware of diagnosis, test results)',
  },
  {
    description: 'Medical equipment/supplies adherence (not using med. equip. as directed)',
  },
  {
    description: 'Other (concerning statements, including emotional state)',
  },
];

/**
 * Each barrierType contains a list of related care plans (ids)- "CarePlanTypes"
 * This function will query to get the care plans ids by the care plan description,
 * and then will insert the id to the CarePlanTypes list in the barrier object
 */
export const createSeedBarriers = async (
  barrierTypeModel: Model<BarrierType>,
  carePlanTypeModel: Model<CarePlanType>,
) => {
  for (const barrier of seedBarriers) {
    const carePlanTypes = await carePlanTypeModel
      .find({
        description: { $in: barrier.carePlanTypes },
      })
      .distinct('_id');
    await barrierTypeModel.create({ ...barrier, carePlanTypes });
  }
};
