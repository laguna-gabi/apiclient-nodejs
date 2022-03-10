import { RedFlagType } from './care.types';

export const redFlags = [
  {
    id: RedFlagType.chronicCondition,
    description: 'Uncontrolled chronic condition (high A1C, high sugars, high BP)',
  },
  {
    id: RedFlagType.appointment,
    description: 'Appointment adherence (missed appts/unable to schedule appts)',
  },
  {
    id: RedFlagType.resources,
    description: 'Resource utilization (trips to ER, requesting unnecessary tests/procedures)',
  },
  {
    id: RedFlagType.medication,
    description: 'Medication adherence (missed/not taking meds, unable to order meds)',
  },
  {
    id: RedFlagType.planOfCare,
    description:
      'Plan of care (POC) Adherence (not following previous plan of care/recommendations)',
  },
  {
    id: RedFlagType.weight,
    description: 'Significant weight loss/gain (+10 lbs.)',
  },
  {
    id: RedFlagType.health,
    description: 'Knowledge of health or health care status (unaware of diagnosis, test results)',
  },
  {
    id: RedFlagType.medicalSupplies,
    description: 'Medical equipment/supplies adherence (not using med. equip. as directed)',
  },
  {
    id: RedFlagType.other,
    description: 'Other (concerning statements, including emotional state)',
  },
];
