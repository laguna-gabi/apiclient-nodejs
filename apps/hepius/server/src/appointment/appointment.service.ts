import { Appointment, AppointmentStatus, Notes } from '@argus/hepiusClient';
import { formatEx } from '@argus/pandora';
import { Injectable } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { hosts } from 'config';
import { add, sub } from 'date-fns';
import { isUndefined, omitBy } from 'lodash';
import { Model, Types } from 'mongoose';
import {
  AppointmentDocument,
  EndAppointmentParams,
  NotesDocument,
  RequestAppointmentParams,
  ScheduleAppointmentParams,
  UpdateNotesParams,
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
  IEventOnDeletedMemberAppointments,
  IEventOnNewAppointment,
  IEventOnUpdatedAppointmentScores,
  LoggerService,
} from '../common';
import { ISoftDelete } from '../db';
import { JourneyService } from '../journey';
import { Member } from '../member';
import { Internationalization } from '../providers';
import { Recording, RecordingDocument } from '../recording';

@Injectable()
export class AppointmentService extends AlertService {
  constructor(
    @InjectModel(Appointment.name)
    private readonly appointmentModel: Model<AppointmentDocument> &
      ISoftDelete<AppointmentDocument>,
    @InjectModel(Notes.name)
    private readonly notesModel: Model<NotesDocument> & ISoftDelete<NotesDocument>,
    @InjectModel(DismissedAlert.name)
    readonly dismissAlertModel: Model<DismissedAlertDocument>,
    @InjectModel(Recording.name)
    private readonly recordingModel: Model<RecordingDocument> & ISoftDelete<RecordingDocument>,
    private readonly internationalization: Internationalization,
    readonly journeyService: JourneyService,
    private eventEmitter: EventEmitter2,
    readonly logger: LoggerService,
  ) {
    super(dismissAlertModel);
  }

  async request(params: RequestAppointmentParams): Promise<Appointment> {
    const filter = params.id
      ? { _id: new Types.ObjectId(params.id) }
      : {
          userId: new Types.ObjectId(params.userId),
          memberId: new Types.ObjectId(params.memberId),
          journeyId: new Types.ObjectId(params.journeyId),
          status: AppointmentStatus.requested,
        };

    const result = await this.appointmentModel.findOneAndUpdate(
      filter,
      {
        $set: {
          userId: new Types.ObjectId(params.userId),
          memberId: new Types.ObjectId(params.memberId),
          journeyId: new Types.ObjectId(params.journeyId),
          notBefore: params.notBefore,
          status: AppointmentStatus.requested,
          deleted: false,
        },
      },
      { upsert: true, new: true, rawResult: true },
    );

    if (result.lastErrorObject.upserted) {
      const { id, userId } = result.value;
      return this.postNewAppointmentAction({
        userId: userId.toString(),
        memberId: params.memberId,
        appointmentId: id,
      });
    }

    return result.value;
  }

  async get(id: string): Promise<Appointment> {
    return this.appointmentModel.findById(new Types.ObjectId(id)).populate('notes');
  }

  async getFutureAppointments({
    userId,
    memberId,
    journeyId,
  }: {
    userId: string;
    memberId: string;
    journeyId: string;
  }): Promise<Appointment[]> {
    return this.appointmentModel.find({
      userId: new Types.ObjectId(userId),
      memberId: new Types.ObjectId(memberId),
      journeyId: new Types.ObjectId(journeyId),
      status: { $ne: AppointmentStatus.done },
      start: { $gte: new Date() },
    });
  }

  async schedule(params: ScheduleAppointmentParams): Promise<Appointment> {
    const filter = params.id
      ? { _id: new Types.ObjectId(params.id) }
      : {
          userId: new Types.ObjectId(params.userId),
          memberId: new Types.ObjectId(params.memberId),
          journeyId: new Types.ObjectId(params.journeyId),
          status: { $eq: AppointmentStatus.requested },
        };

    await this.validateOverlap(params);

    const object = await this.appointmentModel.findOneAndUpdate(
      filter,
      {
        $set: {
          userId: new Types.ObjectId(params.userId),
          memberId: new Types.ObjectId(params.memberId),
          journeyId: new Types.ObjectId(params.journeyId),
          method: params.method,
          start: params.start,
          end: params.end,
          status: AppointmentStatus.scheduled,
          deleted: false,
        },
      },
      { upsert: params.id === undefined, new: true, rawResult: true },
    );

    if (params.id && object.lastErrorObject.n === 0) {
      throw new Error(Errors.get(ErrorType.appointmentIdNotFound));
    }

    if (!object.lastErrorObject.updatedExisting) {
      return this.postNewAppointmentAction({
        userId: object.value.userId.toString(),
        memberId: params.memberId,
        appointmentId: object.value.id,
      });
    }

    return object.value;
  }

  async validateOverlap(params: ScheduleAppointmentParams) {
    const sharedQuery = {
      userId: new Types.ObjectId(params.userId),
      status: { $nin: [AppointmentStatus.done] },
      deleted: false,
      ...(params.id ? { _id: { $ne: new Types.ObjectId(params.id) } } : {}),
    };
    const isOverlappingAppointments = await this.appointmentModel.exists({
      $or: [
        // start of appointment in range
        {
          ...sharedQuery,
          start: { $lte: params.start },
          end: { $gt: params.start },
        },
        // start of appointment in range
        {
          ...sharedQuery,
          start: { $lt: params.end },
          end: { $gte: params.end },
        },
      ],
    });

    if (isOverlappingAppointments) {
      throw new Error(Errors.get(ErrorType.appointmentOverlaps));
    }
  }

  async end(params: EndAppointmentParams): Promise<Appointment> {
    const existing = await this.appointmentModel.findById(new Types.ObjectId(params.id));
    if (!existing) {
      throw new Error(Errors.get(ErrorType.appointmentIdNotFound));
    }

    const { id, noShow, noShowReason, notes } = params;
    let result;
    const update = omitBy(
      {
        status: AppointmentStatus.done,
        noShow,
        noShowReason,
      },
      isUndefined,
    );

    if (notes === undefined) {
      result = await this.appointmentModel
        .findOneAndUpdate({ _id: id }, { $set: { ...update } }, { new: true })
        .populate([{ path: 'notes', strictPopulate: false }]);
    } else if (notes === null) {
      if (existing.notes) {
        await this.deleteNotes({ notes: existing.notes });
      }
      result = await this.appointmentModel
        .findOneAndUpdate({ _id: id }, { $set: { ...update, notes: null } }, { new: true })
        .populate('notes');
    } else {
      let notesId;
      if (existing.notes) {
        const result = await this.notesModel
          .findByIdAndUpdate({ _id: existing.notes }, { $set: notes }, { upsert: true, new: true })
          .populate([{ path: 'notes', strictPopulate: false }]);
        notesId = result._id;
      } else {
        const { _id } = await this.notesModel.create(notes);
        notesId = _id;
      }
      result = await this.appointmentModel
        .findOneAndUpdate({ _id: id }, { $set: update, notes: notesId }, { new: true })
        .populate([{ path: 'notes', strictPopulate: false }]);
    }

    if (notes?.scores) {
      const eventParams: IEventOnUpdatedAppointmentScores = {
        memberId: existing.memberId.toString(),
        scores: params.notes.scores,
      };
      this.eventEmitter.emit(EventType.onUpdatedAppointmentScores, eventParams);
    }

    return this.replaceId(result.toObject() as AppointmentDocument);
  }

  async delete({
    id,
    deletedBy,
    hard = false,
  }: {
    id: string;
    deletedBy?: string;
    hard?: boolean;
  }): Promise<boolean> {
    const result = await this.appointmentModel.findOneWithDeleted({ _id: new Types.ObjectId(id) });
    if (!result) {
      throw new Error(Errors.get(ErrorType.appointmentIdNotFound));
    }
    const deletedByObject = new Types.ObjectId(deletedBy);
    if (hard) {
      await this.appointmentModel.deleteOne({ _id: new Types.ObjectId(id) });
    } else {
      await result.delete(deletedByObject);
    }

    if (result.notes) {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      await this.deleteNotes({ notes: result.notes._id, deletedBy: deletedByObject, hard });
    }
    return true;
  }

  private async deleteNotes({
    notes,
    deletedBy,
    hard = false,
  }: {
    notes;
    deletedBy?: Types.ObjectId;
    hard?: boolean;
  }) {
    if (hard) {
      await this.notesModel.deleteOne({ _id: notes });
    } else {
      const notesResult = await this.notesModel.findOneWithDeleted({ _id: notes });
      await notesResult.delete(deletedBy);
    }
  }

  private async postNewAppointmentAction({
    userId,
    memberId,
    appointmentId,
  }: {
    userId: string;
    memberId: string;
    appointmentId: string;
  }) {
    const eventParams: IEventOnNewAppointment = { memberId, userId, appointmentId };
    this.eventEmitter.emit(EventType.onNewAppointment, eventParams);

    const link = `${hosts.app}/${appointmentId.toString()}`;

    const result = await this.appointmentModel.findOneAndUpdate(
      { _id: appointmentId },
      { $set: { link } },
      { upsert: true, new: true, rawResult: true },
    );

    return result.value;
  }

  async updateNotes(params: UpdateNotesParams): Promise<Notes | null> {
    const existing = await this.appointmentModel.findById(new Types.ObjectId(params.appointmentId));
    if (!existing) {
      throw new Error(Errors.get(ErrorType.appointmentIdNotFound));
    }

    if (params.notes === null) {
      if (existing.notes) {
        await this.deleteNotes({ notes: existing.notes });
        await this.appointmentModel.findOneAndUpdate(
          { _id: params.appointmentId },
          { $set: { notes: null } },
        );
      }
      return null;
    } else {
      let note;
      if (existing.notes) {
        note = await this.notesModel.findOneAndUpdate(
          { _id: existing.notes },
          { $set: params.notes },
          { upsert: true, new: true },
        );
      } else {
        note = await this.notesModel.create(params.notes);
        await this.appointmentModel.findOneAndUpdate(
          { _id: existing.id },
          { $set: { notes: note._id } },
        );
      }

      return note;
    }
  }

  async getMemberScheduledAppointments(memberId: string): Promise<Appointment[]> {
    return this.appointmentModel.find({
      memberId: new Types.ObjectId(memberId),
      status: AppointmentStatus.scheduled,
    });
  }

  async validateUpdateAppointment(id: string) {
    if (id) {
      const existingAppointment = await this.get(id);
      if (!existingAppointment) {
        throw new Error(Errors.get(ErrorType.appointmentIdNotFound));
      }
      if (existingAppointment.status === AppointmentStatus.done) {
        throw new Error(Errors.get(ErrorType.appointmentCanNotBeUpdated));
      }
    }
  }

  @OnEvent(EventType.onDeletedMember, { async: true })
  async deleteMemberAppointments(params: IEventDeleteMember) {
    this.logger.info(params, AppointmentService.name, this.deleteMemberAppointments.name);
    const { memberId, hard, deletedBy } = params;
    try {
      const appointments = await this.appointmentModel.findWithDeleted({
        memberId: new Types.ObjectId(memberId),
      });
      if (!appointments) return;
      const eventParams: IEventOnDeletedMemberAppointments = { appointments };
      this.eventEmitter.emit(EventType.onDeletedMemberAppointments, eventParams);
      await Promise.all(
        appointments.map(async (appointment) => {
          await this.delete({ id: appointment.id, deletedBy, hard });
        }),
      );
    } catch (ex) {
      this.logger.error(
        params,
        AppointmentService.name,
        this.deleteMemberAppointments.name,
        formatEx(ex),
      );
    }
  }

  async entityToAlerts(member): Promise<Alert[]> {
    let alerts: Alert[] = [];

    // Collect appointment related alerts
    alerts = alerts.concat(await this.appointmentsItemsToAlerts(member));

    return alerts;
  }

  private async appointmentsItemsToAlerts(member: Member): Promise<Alert[]> {
    // collect all member recordings
    const recordings = await this.recordingModel.find({
      memberId: new Types.ObjectId(member.id),
      review: { $exists: true },
    });

    // collect all reviewed appointments (push all reviewed appointment ids to an array)
    const reviewAppointmentAlerts = recordings.map((recording) => {
      return {
        id: `${recording.id}_${AlertType.appointmentReviewed}`,
        type: AlertType.appointmentReviewed,
        date: recording.review.createdAt,
        text: this.internationalization.getAlerts(AlertType.appointmentReviewed, {
          member,
        }),
        memberId: member.id,
      } as Alert;
    });

    // grab all `scheduled` (status) appointments where `end` occurred more than 24hrs ago (overdue for submit)
    const { id: journeyId } = await this.journeyService.getRecent(member.id);
    const appointments = await this.appointmentModel.find({
      memberId: new Types.ObjectId(member.id),
      journeyId: new Types.ObjectId(journeyId),
      status: AppointmentStatus.scheduled,
      end: { $lte: sub(new Date(), { days: 1 }) },
    });

    const appointmentSubmitOverdueAlerts = appointments.map((appointment) => {
      return {
        id: `${appointment.id}_${AlertType.appointmentSubmitOverdue}`,
        type: AlertType.appointmentSubmitOverdue,
        date: add(appointment.end, { days: 1 }),
        text: this.internationalization.getAlerts(AlertType.appointmentSubmitOverdue, {
          member,
        }),
        memberId: member.id,
      } as Alert;
    });

    return [reviewAppointmentAlerts, appointmentSubmitOverdueAlerts].flat();
  }
}
