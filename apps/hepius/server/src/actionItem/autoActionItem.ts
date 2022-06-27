import { formatEx } from '@argus/pandora';
import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  ActionItemCategory,
  ActionItemService,
  AutoActionItemRelatedEntities,
  AutoActionMainItemType,
  autoActionsMap,
} from '.';
import {
  EventType,
  IEventBaseAutoActionItem,
  IEventOnBarrierCreated,
  IEventOnFirstAppointment,
  LoggerService,
  RelatedEntityType,
} from '../common';
import { Internationalization } from '../providers';
import { QuestionnaireService } from '../questionnaire';

@Injectable()
export class AutoActionItem {
  constructor(
    private readonly actionItemService: ActionItemService,
    private readonly questionnaireService: QuestionnaireService,
    private readonly internationalization: Internationalization,
    private readonly logger: LoggerService,
  ) {}

  @OnEvent(EventType.onFirstAppointment, { async: true })
  async handleFirstAppointment(params: IEventOnFirstAppointment) {
    await this.createAutoActionItem({
      type: AutoActionMainItemType.firstAppointment,
      params,
      methodName: this.handleFirstAppointment.name,
      category: ActionItemCategory.jobAid,
    });
  }

  @OnEvent(EventType.onBarrierCreated, { async: true })
  async handleBarrierCreated(params: IEventOnBarrierCreated) {
    const findResults = Object.values(AutoActionMainItemType).find(
      (type) => type === params.barrierDescription.toLowerCase(),
    );
    if (findResults) {
      const newParams = { memberId: params.memberId, barrierId: params.barrierId };
      await this.createAutoActionItem({
        type: AutoActionMainItemType.fatigue,
        params: newParams,
        methodName: this.handleBarrierCreated.name,
        category: ActionItemCategory.poc,
      });
    }
  }

  private async createAutoActionItem({
    type,
    params,
    methodName,
    category,
  }: {
    type: AutoActionMainItemType;
    params: IEventBaseAutoActionItem;
    methodName: string;
    category: ActionItemCategory;
  }) {
    this.logger.info(params, AutoActionItem.name, methodName);
    try {
      return Promise.all(
        autoActionsMap.get(type).map(async ({ autoActionItemType, relatedEntities }) => {
          return this.actionItemService.createOrSetActionItem({
            ...this.internationalization.getActionItem(autoActionItemType),
            relatedEntities: relatedEntities
              ? await this.populateRelatedEntities(relatedEntities)
              : undefined,
            category,
            ...params,
          });
        }),
      );
    } catch (ex) {
      this.logger.error(params, AutoActionItem.name, methodName, formatEx(ex));
    }
  }

  private async populateRelatedEntities(relatedEntities: AutoActionItemRelatedEntities[]) {
    return Promise.all(
      relatedEntities.map(async ({ type, questionnaireType }) => {
        if (type === RelatedEntityType.questionnaire) {
          const { id } = await this.questionnaireService.getQuestionnaireByType(questionnaireType);
          return { type, id };
        } else {
          return { type };
        }
      }),
    );
  }
}
