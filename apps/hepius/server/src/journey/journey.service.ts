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
  LoggerService,
  deleteMemberObjects,
} from '../common';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ISoftDelete } from '../db';
import {
  CreateJourneyParams,
  GraduateMemberParams,
  Journey,
  JourneyDocument,
  SetGeneralNotesParams,
  UpdateJourneyParams,
} from '.';
import { Identifier } from '@argus/hepiusClient';
import { OnEvent } from '@nestjs/event-emitter';
import { isEmpty, isNil, omitBy } from 'lodash';
import {
  ActionItem,
  ActionItemDocument,
  ActionItemStatus,
  CreateActionItemParams,
  Journal,
  JournalDocument,
  UpdateActionItemStatusParams,
  UpdateJournalParams,
} from './';
import { Internationalization } from '../providers';

@Injectable()
export class JourneyService extends AlertService {
  constructor(
    @InjectModel(Journey.name)
    private readonly journeyModel: Model<JourneyDocument> & ISoftDelete<JourneyDocument>,
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

  async create(params: CreateJourneyParams): Promise<Identifier> {
    const memberIdObject = { memberId: new Types.ObjectId(params.memberId) };
    const { _id: id } = await this.journeyModel.create(memberIdObject);
    return { id };
  }

  async get(journeyId: string): Promise<Journey> {
    const result = await this.journeyModel.findById(new Types.ObjectId(journeyId));
    if (!result) {
      throw new Error(Errors.get(ErrorType.journeyNotFound));
    }

    return result.toObject();
  }

  async getRecent(memberId: string): Promise<Journey> {
    const [result] = await this.journeyModel
      .find({ memberId: new Types.ObjectId(memberId) })
      .sort({ _id: -1 })
      .limit(1);
    if (!result) {
      throw new Error(Errors.get(ErrorType.memberNotFound));
    }
    return result;
  }

  async getAll({ memberId }: { memberId: string }): Promise<Journey[]> {
    return this.journeyModel.find({ memberId: new Types.ObjectId(memberId) }).sort({ _id: -1 });
  }

  async update(updateJourneyParams: UpdateJourneyParams): Promise<Journey> {
    const setParams = omitBy(updateJourneyParams, isNil);
    delete setParams.memberId;

    const exisingRecord = await this.getRecent(updateJourneyParams.memberId);
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
      return result.toObject();
    }
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
    const setParams = omitBy(
      {
        generalNotes: setGeneralNotesParams.note,
        nurseNotes: setGeneralNotesParams.nurseNotes,
      },
      isNil,
    );
    const recent = await this.getRecent(setGeneralNotesParams.memberId);
    await this.journeyModel.findByIdAndUpdate(recent.id, { $set: setParams });
  }

  /*************************************************************************************************
   ****************************************** Action item ******************************************
   ************************************************************************************************/

  async insertActionItem({
    createActionItemParams,
    status,
  }: {
    createActionItemParams: CreateActionItemParams;
    status: ActionItemStatus;
  }): Promise<Identifier> {
    const recentJourney = await this.getRecent(createActionItemParams.memberId);
    const identifiers = {
      memberId: new Types.ObjectId(createActionItemParams.memberId),
      journeyId: new Types.ObjectId(recentJourney.id),
    };
    delete createActionItemParams.memberId;
    const { _id } = await this.actionItemModel.create({
      ...createActionItemParams,
      status,
      ...identifiers,
    });

    return { id: _id };
  }

  async updateActionItemStatus(
    updateActionItemStatusParams: UpdateActionItemStatusParams,
  ): Promise<void> {
    const { id, status } = updateActionItemStatusParams;

    const result = await this.actionItemModel.findOneAndUpdate(
      { _id: new Types.ObjectId(id) },
      { $set: { status } },
    );

    if (!result) {
      throw new Error(Errors.get(ErrorType.journeyActionItemIdNotFound));
    }
  }

  async getActionItems(memberId: string): Promise<ActionItem[]> {
    return this.actionItemModel
      .find({ memberId: new Types.ObjectId(memberId) })
      .sort({ updatedAt: -1 });
  }

  async entityToAlerts(member): Promise<Alert[]> {
    return this.actionItemsToAlerts(member);
  }

  private async actionItemsToAlerts(member): Promise<Alert[]> {
    const actionItems = await this.actionItemModel.find({
      memberId: new Types.ObjectId(member.id),
    });
    return actionItems
      .filter(
        (actionItem) =>
          actionItem.status === ActionItemStatus.pending && actionItem.deadline < new Date(),
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
      text: { $exists: true },
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
   ******************************************** Helpers ********************************************
   ************************************************************************************************/
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
