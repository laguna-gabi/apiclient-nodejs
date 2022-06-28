import { RelatedEntity, RelatedEntityType } from '../common';
import { QuestionnaireType } from '../questionnaire';
import { ActionItemLink, ActionItemLinkType } from './actionItem.dto';

/**************************************************************************************************
 ******************* fetching strings, aligning with pandora: languages/en.json *******************
 *************************************************************************************************/
export enum AutoActionAppointmentItemType {
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

export enum AutoActionBarrierFatigueItemType {
  empatheticResponse = 'barrier.fatigue.empatheticResponse',
  assess1 = 'barrier.fatigue.assess1',
  assess2 = 'barrier.fatigue.assess2',
  assess3 = 'barrier.fatigue.assess3',
  assess4 = 'barrier.fatigue.assess4',
  assess5 = 'barrier.fatigue.assess5',
  assess6 = 'barrier.fatigue.assess6',
  assess7 = 'barrier.fatigue.assess7',
  assess8 = 'barrier.fatigue.assess8',
  supportiveStatement = 'barrier.fatigue.supportiveStatement',
  prepareMemberToCallProvider1 = 'barrier.fatigue.prepareMemberToCallProvider1',
  prepareMemberToCallProvider2 = 'barrier.fatigue.prepareMemberToCallProvider2',
  prepareMemberToCallProvider3 = 'barrier.fatigue.prepareMemberToCallProvider3',
  prepareMemberToCallProvider4 = 'barrier.fatigue.prepareMemberToCallProvider4',
  memberTodo = 'barrier.fatigue.memberTodo',
  toDoToEncourage1 = 'barrier.fatigue.toDoToEncourage1',
  toDoToEncourage2 = 'barrier.fatigue.toDoToEncourage2',
  toDoToEncourage3 = 'barrier.fatigue.toDoToEncourage3',
  toDoToEncourage4 = 'barrier.fatigue.toDoToEncourage4',
  toDoToEncourage5 = 'barrier.fatigue.toDoToEncourage5',
  influence = 'barrier.fatigue.influence',
}

export type AutoActionItemType = AutoActionAppointmentItemType | AutoActionBarrierFatigueItemType;

/**************************************************************************************************
 ***************************************** enums by types *****************************************
 *************************************************************************************************/
export class AutoActionItemRelatedEntities extends RelatedEntity {
  questionnaireType?: QuestionnaireType;
}

export type AutoActionItems = {
  autoActionItemType: AutoActionItemType;
  relatedEntities?: AutoActionItemRelatedEntities[];
  link?: ActionItemLink;
}[];

export enum AutoActionMainItemType {
  firstAppointment = 'firstAppointment',
  fatigue = 'fatigue',
}

/**************************************************************************************************
 *************************************** map by value types ***************************************
 *************************************************************************************************/
export const autoActionsMap: Map<AutoActionMainItemType, AutoActionItems> = new Map<
  AutoActionMainItemType,
  AutoActionItems
>([
  [
    AutoActionMainItemType.firstAppointment,
    [
      { autoActionItemType: AutoActionAppointmentItemType.introduceYourself },
      { autoActionItemType: AutoActionAppointmentItemType.introduceLagunaHealth },
      {
        autoActionItemType: AutoActionAppointmentItemType.caregivers,
        relatedEntities: [{ type: RelatedEntityType.caregiver }],
      },
      { autoActionItemType: AutoActionAppointmentItemType.downloadApp },
      { autoActionItemType: AutoActionAppointmentItemType.conversationalAssessment },
      {
        autoActionItemType: AutoActionAppointmentItemType.questionnaire,
        relatedEntities: [
          { type: RelatedEntityType.questionnaire, questionnaireType: QuestionnaireType.gad7 },
          { type: RelatedEntityType.questionnaire, questionnaireType: QuestionnaireType.phq9 },
        ],
      },
      { autoActionItemType: AutoActionAppointmentItemType.careInformation },
      { autoActionItemType: AutoActionAppointmentItemType.homePreparation },
      {
        autoActionItemType: AutoActionAppointmentItemType.poc,
        relatedEntities: [{ type: RelatedEntityType.poc }],
      },
      { autoActionItemType: AutoActionAppointmentItemType.scheduleNextAppointment },
      { autoActionItemType: AutoActionAppointmentItemType.documentation },
    ],
  ],
  [
    AutoActionMainItemType.fatigue,
    [
      { autoActionItemType: AutoActionBarrierFatigueItemType.empatheticResponse },
      { autoActionItemType: AutoActionBarrierFatigueItemType.assess1 },
      { autoActionItemType: AutoActionBarrierFatigueItemType.assess2 },
      { autoActionItemType: AutoActionBarrierFatigueItemType.assess3 },
      { autoActionItemType: AutoActionBarrierFatigueItemType.assess4 },
      { autoActionItemType: AutoActionBarrierFatigueItemType.assess5 },
      { autoActionItemType: AutoActionBarrierFatigueItemType.assess6 },
      { autoActionItemType: AutoActionBarrierFatigueItemType.assess7 },
      { autoActionItemType: AutoActionBarrierFatigueItemType.assess8 },
      { autoActionItemType: AutoActionBarrierFatigueItemType.supportiveStatement },
      { autoActionItemType: AutoActionBarrierFatigueItemType.prepareMemberToCallProvider1 },
      { autoActionItemType: AutoActionBarrierFatigueItemType.prepareMemberToCallProvider2 },
      { autoActionItemType: AutoActionBarrierFatigueItemType.prepareMemberToCallProvider3 },
      { autoActionItemType: AutoActionBarrierFatigueItemType.prepareMemberToCallProvider4 },
      {
        autoActionItemType: AutoActionBarrierFatigueItemType.memberTodo,
        link: { type: ActionItemLinkType.createTodo },
      },
      { autoActionItemType: AutoActionBarrierFatigueItemType.toDoToEncourage1 },
      { autoActionItemType: AutoActionBarrierFatigueItemType.toDoToEncourage2 },
      { autoActionItemType: AutoActionBarrierFatigueItemType.toDoToEncourage3 },
      { autoActionItemType: AutoActionBarrierFatigueItemType.toDoToEncourage4 },
      { autoActionItemType: AutoActionBarrierFatigueItemType.toDoToEncourage5 },
      { autoActionItemType: AutoActionBarrierFatigueItemType.influence },
    ],
  ],
]);
