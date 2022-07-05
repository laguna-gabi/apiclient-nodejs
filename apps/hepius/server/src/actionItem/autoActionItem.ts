import { formatEx } from '@argus/pandora';
import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { hosts } from 'config';

import {
  ActionItemCategory,
  ActionItemLink,
  ActionItemLinkType,
  ActionItemPriority,
  ActionItemService,
  ActionItemSource,
  AutoActionItemRelatedEntities,
  AutoActionMainItemType,
  autoActionsMap,
} from '.';
import {
  EventType,
  IEventBaseAutoActionItem,
  IEventOnBarrierCreated,
  IEventOnFirstAppointment,
  IEventOnHighPainScoreIndication,
  InternalContentKey,
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
      source: ActionItemSource.jobAid,
      category: ActionItemCategory.nextSession,
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
        source: ActionItemSource.poc,
        category: ActionItemCategory.nextSession,
      });
    }
  }

  @OnEvent(EventType.onHighPainScoreIndication, { async: true })
  async handleHighPainScoreIndication(params: IEventOnHighPainScoreIndication) {
    await this.createAutoActionItem({
      type: AutoActionMainItemType.highPainScore,
      params,
      methodName: this.handleHighPainScoreIndication.name,
      priority: ActionItemPriority.urgent,
    });
  }

  private async createAutoActionItem({
    type,
    params,
    methodName,
    category,
    source,
    priority,
  }: {
    type: AutoActionMainItemType;
    params: IEventBaseAutoActionItem;
    methodName: string;
    category?: ActionItemCategory;
    source?: ActionItemSource;
    priority?: ActionItemPriority;
  }) {
    this.logger.info(params, AutoActionItem.name, methodName);
    try {
      // reverse for sorting by createdAt in harmony
      const autoActionItems = autoActionsMap.get(type).reverse();
      for (const { autoActionItemType, relatedEntities, link } of autoActionItems) {
        await this.actionItemService.createOrSetActionItem({
          ...this.internationalization.getActionItem(autoActionItemType),
          relatedEntities: relatedEntities
            ? await this.populateRelatedEntities(relatedEntities)
            : undefined,
          category,
          link: link ? await this.populateLink(link) : undefined,
          source,
          priority,
          ...params,
        });
      }
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

  private async populateLink(link: ActionItemLink): Promise<ActionItemLink> {
    const { type, value } = link;
    if (type === ActionItemLinkType.sendSMS) {
      return {
        type,
        value: this.internationalization.getContents({
          contentKey: value as InternalContentKey,
          extraData: { dynamicLink: hosts.get('dynamicLink') },
        }),
      };
    } else {
      return link;
    }
  }
}
