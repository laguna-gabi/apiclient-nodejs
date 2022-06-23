import { formatEx } from '@argus/pandora';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
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
  IEventOnUpdatedAppointmentScores,
  IEventUpdateRelatedEntity,
  LoggerService,
  deleteMemberObjects,
} from '../common';
import { ISoftDelete } from '../db';
import {
  ActionItemPriority,
  ControlJourney,
  ControlJourneyDocument,
  GraduateMemberParams,
  Journey,
  JourneyDocument,
  RelatedEntityType,
  ReplaceMemberOrgParams,
  SetGeneralNotesParams,
  UpdateJourneyParams,
  nullableActionItemKeys,
} from '.';
import { Identifier } from '@argus/hepiusClient';
import { OnEvent } from '@nestjs/event-emitter';
import { isEmpty, isNil, omitBy } from 'lodash';
import { Internationalization } from '../providers';
import {
  ActionItem,
  ActionItemDocument,
  ActionItemStatus,
  CreateOrSetActionItemParams,
  Journal,
  JournalDocument,
  UpdateJournalParams,
} from './';

@Injectable()
export class JourneyService extends AlertService {
  constructor(
    @InjectModel(Journey.name)
    private readonly journeyModel: Model<JourneyDocument> & ISoftDelete<JourneyDocument>,
    @InjectModel(ControlJourney.name)
    private readonly controlJourneyModel: Model<ControlJourneyDocument> &
      ISoftDelete<ControlJourneyDocument>,
    @InjectModel(ActionItem.name)
    private readonly actionItemModel: Model<ActionItemDocument> & ISoftDelete<ActionItemDocument>,
    @InjectModel(Journal.name)
    private readonly journalModel: Model<JournalDocument> & ISoftDelete<JournalDocument>,
    @InjectModel(DismissedAlert.name)
    readonly dismissAlertModel: Model<DismissedAlertDocument>,
    private readonly internationalization: Internationalization,
    readonly logger: LoggerService,
  ) {
    super(dismissAlertModel);
  }

  async create({ memberId, orgId }: { memberId: string; orgId: string }): Promise<Identifier> {
    return this.createSub({ memberId, orgId, model: this.journeyModel });
  }

  async createControl({
    memberId,
    orgId,
  }: {
    memberId: string;
    orgId: string;
  }): Promise<Identifier> {
    return this.createSub({ memberId, orgId, model: this.controlJourneyModel });
  }

  async get(journeyId: string): Promise<Journey> {
    const result = await this.journeyModel.findById(new Types.ObjectId(journeyId)).populate('org');
    if (!result) {
      throw new Error(Errors.get(ErrorType.journeyNotFound));
    }

    return result.toObject();
  }

  async getRecent(memberId: string, populate = false): Promise<Journey> {
    return this.getRecentSub(memberId, this.journeyModel, populate);
  }

  async getRecentControl(memberId: string): Promise<Journey> {
    return this.getRecentSub(memberId, this.controlJourneyModel, false);
  }

  async getAll({ memberId }: { memberId: string }): Promise<Journey[]> {
    return this.journeyModel
      .find({ memberId: new Types.ObjectId(memberId) })
      .sort({ _id: -1 })
      .populate('org');
  }

  async update(updateJourneyParams: UpdateJourneyParams): Promise<Journey> {
    const setParams = omitBy(updateJourneyParams, isNil);
    delete setParams.memberId;

    const exisingRecord = await this.getRecent(updateJourneyParams.memberId, true);
    if (!exisingRecord) {
      throw new Error(Errors.get(ErrorType.journeyNotFound));
    }

    if (isEmpty(setParams)) {
      return exisingRecord;
    } else {
      let result = await this.journeyModel.findByIdAndUpdate(
        exisingRecord.id,
        { $set: setParams },
        { new: true },
      );
      if (
        setParams.readmissionRisk &&
        setParams.readmissionRisk !== exisingRecord.readmissionRisk
      ) {
        result = await this.updateReadmissionRiskHistory(
          new Types.ObjectId(exisingRecord.id),
          setParams,
        );
      }
      return result.populate('org');
    }
  }

  async replaceMemberOrg(replaceMemberOrgParams: ReplaceMemberOrgParams): Promise<Journey> {
    const { memberId, journeyId, orgId } = replaceMemberOrgParams;

    const result = await this.journeyModel.findOneAndUpdate(
      { _id: new Types.ObjectId(journeyId), memberId: new Types.ObjectId(memberId) },
      { org: new Types.ObjectId(orgId) },
    );

    if (!result) {
      throw new Error(Errors.get(ErrorType.memberNotFound));
    }

    return result;
  }

  async updateLoggedInAt(memberId: Types.ObjectId): Promise<Journey> {
    this.logger.info({ memberId }, JourneyService.name, this.updateLoggedInAt.name);
    const date = new Date();
    const recent = await this.getRecent(memberId.toString());
    await this.journeyModel.updateOne(
      { _id: new Types.ObjectId(recent.id), firstLoggedInAt: null },
      { $set: { firstLoggedInAt: date } },
      { new: true },
    );
    return this.journeyModel.findByIdAndUpdate(
      recent.id,
      { $set: { lastLoggedInAt: date } },
      { upsert: false, new: true },
    );
  }

  async graduate(graduateParams: GraduateMemberParams) {
    const recent = await this.getRecent(graduateParams.id);
    await this.journeyModel.findByIdAndUpdate(recent.id, {
      $set: {
        isGraduated: graduateParams.isGraduated,
        graduationDate: graduateParams.isGraduated ? Date.now() : null,
      },
    });
  }

  @OnEvent(EventType.onDeletedMember, { async: true })
  async deleteJourney(params: IEventDeleteMember) {
    const data = {
      params,
      logger: this.logger,
      methodName: this.deleteJourney.name,
      serviceName: JourneyService.name,
    };
    await deleteMemberObjects<Model<JourneyDocument> & ISoftDelete<JourneyDocument>>({
      model: this.journeyModel,
      ...data,
    });
    await deleteMemberObjects<Model<ActionItemDocument> & ISoftDelete<ActionItemDocument>>({
      model: this.actionItemModel,
      ...data,
    });
    await deleteMemberObjects<Model<JournalDocument> & ISoftDelete<JournalDocument>>({
      model: this.journalModel,
      ...data,
    });
  }

  /*************************************************************************************************
   ****************************************** General notes ****************************************
   ************************************************************************************************/
  async setGeneralNotes(setGeneralNotesParams: SetGeneralNotesParams): Promise<void> {
    const recent = await this.getRecent(setGeneralNotesParams.memberId);
    await this.journeyModel.findByIdAndUpdate(new Types.ObjectId(recent.id), {
      $set: { generalNotes: setGeneralNotesParams.note },
    });
  }

  /*************************************************************************************************
   ****************************************** Action item ******************************************
   ************************************************************************************************/

  async createOrSetActionItem(
    createOrSetActionItemParams: CreateOrSetActionItemParams,
  ): Promise<Identifier> {
    const { id, memberId, appointmentId, ...params } = createOrSetActionItemParams;

    const setParams = {
      ...params,
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
      const { id: journeyId } = await this.getRecent(memberId);
      const createParams = {
        ...setParams,
        memberId: new Types.ObjectId(memberId),
        journeyId: new Types.ObjectId(journeyId),
        appointmentId: appointmentId ? new Types.ObjectId(appointmentId) : undefined,
      };
      result = await this.actionItemModel.create(createParams);
    }

    return result;
  }

  async getActionItems(memberId: string): Promise<ActionItem[]> {
    const { id: journeyId } = await this.getRecent(memberId);
    return this.actionItemModel
      .find({ memberId: new Types.ObjectId(memberId), journeyId: new Types.ObjectId(journeyId) })
      .sort({ updatedAt: -1 });
  }

  async entityToAlerts(member): Promise<Alert[]> {
    let alerts: Alert[] = [];

    // collect actionItems alerts
    alerts = alerts.concat(await this.actionItemsToAlerts(member));

    return alerts;
  }

  private async actionItemsToAlerts(member): Promise<Alert[]> {
    const { id: journeyId } = await this.getRecent(member.id);
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
    this.logger.info(params, JourneyService.name, this.handleUpdateRelatedEntityActionItem.name);
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
        JourneyService.name,
        this.handleUpdateRelatedEntityActionItem.name,
        formatEx(ex),
      );
    }
  }
  /*************************************************************************************************
   ******************************************** Journal ********************************************
   ************************************************************************************************/

  async createJournal(memberId: string, journeyId: string): Promise<Identifier> {
    const { _id } = await this.journalModel.create({
      memberId: new Types.ObjectId(memberId),
      journeyId: new Types.ObjectId(journeyId),
    });
    return { id: _id };
  }

  async updateJournal(updateJournalParams: UpdateJournalParams): Promise<Journal> {
    const { id, memberId, journeyId } = updateJournalParams;
    delete updateJournalParams.id;
    delete updateJournalParams.memberId;
    delete updateJournalParams.journeyId;

    const result = await this.journalModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(id),
        memberId: new Types.ObjectId(memberId),
        journeyId: new Types.ObjectId(journeyId),
      },
      { $set: updateJournalParams },
      { new: true },
    );

    if (!result) {
      throw new Error(Errors.get(ErrorType.journeyJournalNotFound));
    }

    return result;
  }

  async getJournal(id: string, journeyId: string): Promise<Journal> {
    const result = await this.journalModel.findOne({
      _id: new Types.ObjectId(id),
      journeyId: new Types.ObjectId(journeyId),
    });

    if (!result) {
      throw new Error(Errors.get(ErrorType.journeyJournalNotFound));
    }

    return result;
  }

  async getJournals(journeyId: string): Promise<Journal[]> {
    return this.journalModel.find({
      journeyId: new Types.ObjectId(journeyId),
      $or: [
        { text: { $exists: true } },
        { imageFormat: { $exists: true } },
        { audioFormat: { $exists: true } },
      ],
    });
  }

  async deleteJournal(id: string, memberId: string): Promise<Journal> {
    const result = await this.journalModel.findOneAndDelete({
      _id: new Types.ObjectId(id),
      memberId: new Types.ObjectId(memberId),
    });

    if (!result) {
      throw new Error(Errors.get(ErrorType.journeyJournalNotFound));
    }

    return result;
  }

  /*************************************************************************************************
   ********************************************* Scores *********************************************
   ************************************************************************************************/

  @OnEvent(EventType.onUpdatedAppointmentScores, { async: true })
  async handleAppointmentScoreUpdated(params: IEventOnUpdatedAppointmentScores) {
    this.logger.info(params, JourneyService.name, this.handleAppointmentScoreUpdated.name);
    const recentJourney = await this.getRecent(params.memberId);
    try {
      await this.journeyModel.findByIdAndUpdate(new Types.ObjectId(recentJourney.id), {
        $set: { scores: params.scores },
      });
    } catch (ex) {
      this.logger.error(
        params,
        JourneyService.name,
        this.handleAppointmentScoreUpdated.name,
        formatEx(ex),
      );
    }
  }

  /*************************************************************************************************
   ******************************************** Helpers ********************************************
   ************************************************************************************************/
  private async createSub({
    memberId,
    orgId,
    model,
  }: {
    memberId: string;
    orgId: string;
    model: Model<JourneyDocument | ControlJourneyDocument>;
  }): Promise<Identifier> {
    const { _id: id } = await model.create({
      memberId: new Types.ObjectId(memberId),
      org: new Types.ObjectId(orgId),
    });
    return { id };
  }

  private async getRecentSub(
    memberId: string,
    model: Model<JourneyDocument | ControlJourneyDocument>,
    populate: boolean,
  ): Promise<Journey> {
    const [result] = await model
      .find({ memberId: new Types.ObjectId(memberId) })
      .sort({ _id: -1 })
      .limit(1);
    if (!result) {
      throw new Error(Errors.get(ErrorType.memberNotFound));
    }
    return populate ? this.journeyModel.populate(result, [{ path: 'org' }]) : result;
  }

  private async updateReadmissionRiskHistory(id: Types.ObjectId, setParams) {
    return this.journeyModel.findByIdAndUpdate(
      id,
      {
        $push: {
          readmissionRiskHistory: {
            readmissionRisk: setParams.readmissionRisk,
            date: new Date(),
          },
        },
      },
      { new: true },
    );
  }
}
