import { formatEx } from '@argus/pandora';
import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  ActionItemCategory,
  ActionItemService,
  AutoActionItemRelatedEntities,
  AutoActionItems,
  autoActionItemsOnFirstAppointment,
} from '.';
import { EventType, IEventOnFirstAppointment, LoggerService, RelatedEntityType } from '../common';
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
    this.logger.info(params, AutoActionItem.name, this.handleFirstAppointment.name);
    try {
      const { memberId, appointmentId } = params;
      await this.createAutoActionItem({
        autoActionItem: autoActionItemsOnFirstAppointment,
        category: ActionItemCategory.jobAid,
        memberId,
        appointmentId,
      });
    } catch (ex) {
      this.logger.error(
        params,
        AutoActionItem.name,
        this.handleFirstAppointment.name,
        formatEx(ex),
      );
    }
  }

  private async createAutoActionItem({
    autoActionItem,
    category,
    memberId,
    appointmentId,
  }: {
    autoActionItem: AutoActionItems;
    category: ActionItemCategory;
    memberId: string;
    appointmentId?: string;
  }) {
    return Promise.all(
      autoActionItem.map(async ({ autoActionItemType, relatedEntities }) => {
        return this.actionItemService.createOrSetActionItem({
          ...this.internationalization.getActionItem(autoActionItemType),
          relatedEntities: relatedEntities
            ? await this.populateRelatedEntities(relatedEntities)
            : undefined,
          category,
          memberId,
          appointmentId,
        });
      }),
    );
  }

  private async populateRelatedEntities(relatedEntities: AutoActionItemRelatedEntities[]) {
    return Promise.all(
      relatedEntities.map(async ({ type, questionnaireType }) => {
        if (type === RelatedEntityType.questionnaire) {
          const { id } = await this.questionnaireService.getQuestionnaireByType(questionnaireType);
          return {
            type,
            id,
          };
        } else {
          return { type };
        }
      }),
    );
  }
}
