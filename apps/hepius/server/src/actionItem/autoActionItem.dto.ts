import { RelatedEntity, RelatedEntityType } from '../common';
import { QuestionnaireType } from '../questionnaire';

export enum AutoActionItemType {
  // onFirstAppointment
  introduceYourself = 'appointment.introduceYourself',
  introduceLagunaHealth = 'appointment.introduceLagunaHealth',
  caregivers = 'appointment.caregivers',
  downloadApp = 'appointment.downloadApp',
  conversationalAssessment = 'appointment.conversationalAssessment',
  questionnaire = 'appointment.questionnaire',
  careInformation = 'appointment.careInformation',
  homePreparation = 'appointment.homePreparation',
  poc = 'appointment.poc',
  scheduleNextAppointment = 'appointment.scheduleNextAppointment',
  documentation = 'appointment.documentation',
}

export class AutoActionItemRelatedEntities extends RelatedEntity {
  questionnaireType?: QuestionnaireType;
}

export type AutoActionItems = {
  autoActionItemType: AutoActionItemType;
  relatedEntities?: AutoActionItemRelatedEntities[];
}[];

export const autoActionItemsOnFirstAppointment: AutoActionItems = [
  { autoActionItemType: AutoActionItemType.introduceYourself },
  { autoActionItemType: AutoActionItemType.introduceLagunaHealth },
  {
    autoActionItemType: AutoActionItemType.caregivers,
    relatedEntities: [{ type: RelatedEntityType.caregiver }],
  },
  { autoActionItemType: AutoActionItemType.downloadApp },
  { autoActionItemType: AutoActionItemType.conversationalAssessment },
  {
    autoActionItemType: AutoActionItemType.questionnaire,
    relatedEntities: [
      { type: RelatedEntityType.questionnaire, questionnaireType: QuestionnaireType.gad7 },
      { type: RelatedEntityType.questionnaire, questionnaireType: QuestionnaireType.phq9 },
    ],
  },
  { autoActionItemType: AutoActionItemType.careInformation },
  { autoActionItemType: AutoActionItemType.homePreparation },
  {
    autoActionItemType: AutoActionItemType.poc,
    relatedEntities: [{ type: RelatedEntityType.poc }],
  },
  { autoActionItemType: AutoActionItemType.scheduleNextAppointment },
  { autoActionItemType: AutoActionItemType.documentation },
];
