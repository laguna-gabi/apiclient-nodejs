import { InternalContentKey, RelatedEntity, RelatedEntityType } from '../common';
import { QuestionnaireType } from '../questionnaire';
import { ActionTodoLabel } from '../todo';
import { ActionItemLink, ActionItemLinkType } from './actionItem.dto';

/**************************************************************************************************
 ******************* fetching strings, aligning with pandora: languages/en.json *******************
 *************************************************************************************************/
export enum AutoActionAppointmentItemType {
  introduceYourself = 'appointment.introduceYourself',
  downloadApp = 'appointment.downloadApp',
  clinicalStatus = 'appointment.clinicalStatus',
  pillarsOfRecovery = 'appointment.pillarsOfRecovery',
  PersonaQuestionnaire = 'appointment.PersonaQuestionnaire',
  caregivers = 'appointment.caregivers',
  poc = 'appointment.poc',
  homePreparation = 'appointment.homePreparation',
}

export enum AutoActionBarrierFatigueItemType {
  assess1 = 'barrier.fatigue.assess1',
  assess2 = 'barrier.fatigue.assess2',
  assess3 = 'barrier.fatigue.assess3',
  prepareMemberToCallProvider1 = 'barrier.fatigue.prepareMemberToCallProvider1',
  prepareMemberToCallProvider2 = 'barrier.fatigue.prepareMemberToCallProvider2',
  prepareMemberToCallProvider3 = 'barrier.fatigue.prepareMemberToCallProvider3',
  phq9Questionnaire = 'barrier.fatigue.phq9Questionnaire',
  memberTodo1 = 'barrier.fatigue.memberTodo1',
  memberTodo2 = 'barrier.fatigue.memberTodo2',
}

export enum AutoActionHighPainScoreItemType {
  highPainScore = 'dailyLog.highPainScore',
}

export type AutoActionItemType =
  | AutoActionAppointmentItemType
  | AutoActionBarrierFatigueItemType
  | AutoActionHighPainScoreItemType;

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
  highPainScore = 'highPainScore',
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
      {
        autoActionItemType: AutoActionAppointmentItemType.downloadApp,
        link: {
          type: ActionItemLinkType.sendSMS,
          value: InternalContentKey.newMemberNudgeAnonymous,
        },
      },
      { autoActionItemType: AutoActionAppointmentItemType.clinicalStatus },
      {
        autoActionItemType: AutoActionAppointmentItemType.pillarsOfRecovery,
        relatedEntities: [
          { type: RelatedEntityType.questionnaire, questionnaireType: QuestionnaireType.mdl },
        ],
      },
      {
        autoActionItemType: AutoActionAppointmentItemType.PersonaQuestionnaire,
        relatedEntities: [
          { type: RelatedEntityType.questionnaire, questionnaireType: QuestionnaireType.lhp },
        ],
      },
      {
        autoActionItemType: AutoActionAppointmentItemType.caregivers,
        link: { type: ActionItemLinkType.createCaregiver },
      },
      { autoActionItemType: AutoActionAppointmentItemType.poc },
      {
        autoActionItemType: AutoActionAppointmentItemType.homePreparation,
        link: { type: ActionItemLinkType.createTodo, value: ActionTodoLabel.Explore },
      },
    ],
  ],
  [
    AutoActionMainItemType.fatigue,
    [
      { autoActionItemType: AutoActionBarrierFatigueItemType.assess1 },
      { autoActionItemType: AutoActionBarrierFatigueItemType.assess2 },
      { autoActionItemType: AutoActionBarrierFatigueItemType.assess3 },
      { autoActionItemType: AutoActionBarrierFatigueItemType.prepareMemberToCallProvider1 },
      { autoActionItemType: AutoActionBarrierFatigueItemType.prepareMemberToCallProvider2 },
      { autoActionItemType: AutoActionBarrierFatigueItemType.prepareMemberToCallProvider3 },
      {
        autoActionItemType: AutoActionBarrierFatigueItemType.phq9Questionnaire,
        relatedEntities: [
          { type: RelatedEntityType.questionnaire, questionnaireType: QuestionnaireType.phq9 },
        ],
      },
      {
        autoActionItemType: AutoActionBarrierFatigueItemType.memberTodo1,
        link: { type: ActionItemLinkType.createTodo, value: ActionTodoLabel.Explore },
      },
      {
        autoActionItemType: AutoActionBarrierFatigueItemType.memberTodo2,
        link: { type: ActionItemLinkType.createTodo },
      },
    ],
  ],
  [
    AutoActionMainItemType.highPainScore,
    [{ autoActionItemType: AutoActionHighPainScoreItemType.highPainScore }],
  ],
]);
