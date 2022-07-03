import { Identifier } from '@argus/hepiusClient';
import { formatEx } from '@argus/pandora';
import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { isNil } from 'lodash';
import { Model, Types } from 'mongoose';
import {
  ActionItem,
  ActionItemDocument,
  ActionItemPriority,
  ActionItemStatus,
  CreateOrSetActionItemParams,
  nullableActionItemKeys,
} from '.';
import {
  Alert,
  AlertService,
  AlertType,
  DismissedAlert,
  DismissedAlertDocument,
  ErrorType,
  Errors,
  EventType,
  IEventDeleteMember,
  IEventUpdateRelatedEntity,
  LoggerService,
  RelatedEntityType,
  deleteMemberObjects,
} from '../common';
import { ISoftDelete } from '../db';
import { JourneyService } from '../journey';
import { Internationalization } from '../providers';

@Injectable()
export class ActionItemService extends AlertService {
  constructor(
    @InjectModel(ActionItem.name)
    private readonly actionItemModel: Model<ActionItemDocument> & ISoftDelete<ActionItemDocument>,
    @InjectModel(DismissedAlert.name)
    readonly dismissAlertModel: Model<DismissedAlertDocument>,
    readonly journeyService: JourneyService,
    private readonly internationalization: Internationalization,
    readonly logger: LoggerService,
  ) {
    super(dismissAlertModel);
  }

  async createOrSetActionItem(
    createOrSetActionItemParams: CreateOrSetActionItemParams,
  ): Promise<Identifier> {
    const { id, memberId, appointmentId, barrierId, ...params } = createOrSetActionItemParams;
    const appointmentIdObject = appointmentId
      ? { appointmentId: new Types.ObjectId(appointmentId) }
      : {};

    const setParams = {
      ...params,
      ...appointmentIdObject,
      // set default params
      status: params.status || ActionItemStatus.active,
      priority: params.priority || ActionItemPriority.normal,
      relatedEntities: params.relatedEntities || [],
      title: params.title || '',
    };

    let result;
    // if there's an id in the request, perform an update
    if (id) {
      // This is required in order to allow overriding with undefined (removing properties from the object).
      // Every nullable property that is not set in the createOrSetActionItemParams will be removed (unset).
      const unsetParams = {};
      nullableActionItemKeys.forEach((key) => {
        if (isNil(createOrSetActionItemParams[key])) {
          unsetParams[key] = 1;
          delete setParams[key];
        }
      });
      result = await this.actionItemModel.findByIdAndUpdate(
        new Types.ObjectId(id),
        { $set: setParams, $unset: unsetParams },
        {
          new: true,
        },
      );
      if (!result) {
        throw new Error(Errors.get(ErrorType.journeyActionItemIdNotFound));
      }
    } else {
      // create a new action item
      const { id: journeyId } = await this.journeyService.getRecent(memberId);
      const barrierIdObject = barrierId ? { barrierId: new Types.ObjectId(barrierId) } : {};
      const createParams = {
        ...setParams,
        memberId: new Types.ObjectId(memberId),
        journeyId: new Types.ObjectId(journeyId),
        ...barrierIdObject,
      };
      result = await this.actionItemModel.create(createParams);
    }

    return result;
  }

  async getActionItems(memberId: string): Promise<ActionItem[]> {
    const { id: journeyId } = await this.journeyService.getRecent(memberId);
    return this.actionItemModel.find({
      memberId: new Types.ObjectId(memberId),
      journeyId: new Types.ObjectId(journeyId),
    });
  }

  async entityToAlerts(member): Promise<Alert[]> {
    let alerts: Alert[] = [];

    // collect actionItems alerts
    alerts = alerts.concat(await this.actionItemsToAlerts(member));

    return alerts;
  }

  private async actionItemsToAlerts(member): Promise<Alert[]> {
    const { id: journeyId } = await this.journeyService.getRecent(member.id);
    const actionItems = await this.actionItemModel.find({
      memberId: new Types.ObjectId(member.id),
      journeyId: new Types.ObjectId(journeyId),
    });
    return actionItems
      .filter(
        (actionItem) =>
          actionItem.status === ActionItemStatus.active && actionItem.deadline < new Date(),
      )
      .map(
        (actionItem) =>
          ({
            id: `${actionItem.id}_${AlertType.actionItemOverdue}`,
            type: AlertType.actionItemOverdue,
            date: actionItem.deadline,
            text: this.internationalization.getAlerts(AlertType.actionItemOverdue, { member }),
            memberId: member.id,
          } as Alert),
      );
  }

  @OnEvent(EventType.onUpdateRelatedEntity, { async: true })
  async handleUpdateRelatedEntityActionItem(params: IEventUpdateRelatedEntity) {
    this.logger.info(params, ActionItemService.name, this.handleUpdateRelatedEntityActionItem.name);
    try {
      const { destEntity, sourceEntity } = params;
      switch (destEntity.type) {
        // only handle action items events (this eventType can be used for other entities)
        case RelatedEntityType.actionItem:
          const actionItem = await this.actionItemModel.findById(new Types.ObjectId(destEntity.id));
          const updateParams: Partial<CreateOrSetActionItemParams> = {
            relatedEntities: actionItem.relatedEntities.concat(sourceEntity),
          };

          if (sourceEntity.type === RelatedEntityType.questionnaireResponse) {
            updateParams.status = ActionItemStatus.completed;
          }
          await this.actionItemModel.findOneAndUpdate(
            { _id: new Types.ObjectId(destEntity.id) },
            { $set: updateParams },
          );
      }
    } catch (ex) {
      this.logger.error(
        params,
        ActionItemService.name,
        this.handleUpdateRelatedEntityActionItem.name,
        formatEx(ex),
      );
    }
  }

  @OnEvent(EventType.onDeletedMember, { async: true })
  async deleteActionItem(params: IEventDeleteMember) {
    const data = {
      params,
      logger: this.logger,
      methodName: this.deleteActionItem.name,
      serviceName: ActionItemService.name,
    };
    await deleteMemberObjects<Model<ActionItemDocument> & ISoftDelete<ActionItemDocument>>({
      model: this.actionItemModel,
      ...data,
    });
  }
}
