import { formatEx } from '@argus/pandora';
import { Injectable } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { hosts } from 'config';
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
  BaseService,
  ErrorType,
  Errors,
  EventType,
  IEventDeleteMember,
  IEventOnDeletedMemberAppointments,
  IEventOnNewAppointment,
  IEventOnUpdatedAppointmentScores,
  IEventUnconsentedAppointmentEnded,
  LoggerService,
} from '../common';
import { ISoftDelete } from '../db';
import { Appointment, AppointmentStatus, Notes } from '@argus/hepiusClient';

@Injectable()
export class AppointmentService extends BaseService {
  constructor(
    @InjectModel(Appointment.name)
    private readonly appointmentModel: Model<AppointmentDocument> &
      ISoftDelete<AppointmentDocument>,
    @InjectModel(Notes.name)
    private readonly notesModel: Model<NotesDocument> & ISoftDelete<NotesDocument>,
    private eventEmitter: EventEmitter2,
    readonly logger: LoggerService,
  ) {
    super();
  }

  async request(params: RequestAppointmentParams): Promise<Appointment> {
    const filter = params.id
      ? { _id: new Types.ObjectId(params.id) }
      : {
          userId: new Types.ObjectId(params.userId),
          memberId: new Types.ObjectId(params.memberId),
          status: AppointmentStatus.requested,
        };

    const result = await this.appointmentModel
      .findOneAndUpdate(
        filter,
        {
          $set: {
            userId: new Types.ObjectId(params.userId),
            notBefore: params.notBefore,
            status: AppointmentStatus.requested,
            deleted: false,
          },
        },
        { upsert: true, new: true, rawResult: true },
      )
      .lean();

    if (result.lastErrorObject.upserted) {
      const { _id, userId } = result.value;
      return this.postNewAppointmentAction({
        userId: userId.toString(),
        memberId: params.memberId,
        appointmentId: _id,
      });
    }

    return this.replaceId(result.value);
  }

  async get(id: string): Promise<Appointment> {
    const result = await this.appointmentModel.findById(new Types.ObjectId(id)).populate('notes');
    return this.replaceId(result);
  }

  async getFutureAppointments(userId: string, memberId: string): Promise<Appointment[]> {
    const result = await this.appointmentModel
      .find({
        userId: new Types.ObjectId(userId),
        memberId: new Types.ObjectId(memberId),
        status: { $ne: AppointmentStatus.done },
        start: { $gte: new Date() },
      })
      .lean();
    return result.map((appointment) => this.replaceId(appointment));
  }

  async schedule(params: ScheduleAppointmentParams): Promise<Appointment> {
    const filter = params.id
      ? { _id: new Types.ObjectId(params.id) }
      : {
          userId: new Types.ObjectId(params.userId),
          memberId: new Types.ObjectId(params.memberId),
          status: { $eq: AppointmentStatus.requested },
        };

    await this.validateOverlap(params);

    const object = await this.appointmentModel
      .findOneAndUpdate(
        filter,
        {
          $set: {
            userId: new Types.ObjectId(params.userId),
            memberId: new Types.ObjectId(params.memberId),
            method: params.method,
            start: params.start,
            end: params.end,
            status: AppointmentStatus.scheduled,
            deleted: false,
          },
        },
        { upsert: params.id === undefined, new: true, rawResult: true },
      )
      .lean();

    if (params.id && object.lastErrorObject.n === 0) {
      throw new Error(Errors.get(ErrorType.appointmentIdNotFound));
    }

    if (!object.lastErrorObject.updatedExisting) {
      return this.postNewAppointmentAction({
        userId: object.value.userId.toString(),
        memberId: params.memberId,
        appointmentId: object.value._id,
      });
    }

    return this.replaceId(object.value);
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

    const { noShow, recordingConsent, id, noShowReason } = params;
    let result;
    const update = omitBy(
      {
        status: AppointmentStatus.done,
        noShow,
        noShowReason,
        recordingConsent,
      },
      isUndefined,
    );

    if (params.notes === undefined) {
      result = await this.appointmentModel
        .findOneAndUpdate({ _id: params.id }, { $set: { ...update } }, { new: true })
        .populate([{ path: 'notes', strictPopulate: false }]);
    } else if (params.notes === null) {
      if (existing.notes) {
        await this.deleteNotes({ notes: existing.notes });
      }
      result = await this.appointmentModel
        .findOneAndUpdate({ _id: params.id }, { $set: { ...update, notes: null } }, { new: true })
        .populate('notes');
    } else {
      let notesId;
      if (existing.notes) {
        const result = await this.notesModel
          .findByIdAndUpdate(
            { _id: existing.notes },
            { $set: params.notes },
            { upsert: true, new: true },
          )
          .populate([{ path: 'notes', strictPopulate: false }]);
        notesId = result._id;
      } else {
        const { _id } = await this.notesModel.create(params.notes);
        notesId = _id;
      }
      result = await this.appointmentModel
        .findOneAndUpdate({ _id: params.id }, { $set: update, notes: notesId }, { new: true })
        .populate([{ path: 'notes', strictPopulate: false }]);
    }

    if (params.notes?.scores) {
      const eventParams: IEventOnUpdatedAppointmentScores = {
        memberId: existing.memberId,
        scores: params.notes.scores,
      };
      this.eventEmitter.emit(EventType.onUpdatedAppointmentScores, eventParams);
    }

    if (!noShow && !recordingConsent) {
      const eventParams: IEventUnconsentedAppointmentEnded = {
        appointmentId: id,
        memberId: existing.memberId.toString(),
      };
      this.eventEmitter.emit(EventType.onUnconsentedAppointmentEnded, eventParams);
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

    const result = await this.appointmentModel
      .findOneAndUpdate(
        { _id: appointmentId },
        { $set: { link } },
        { upsert: true, new: true, rawResult: true },
      )
      .lean();

    return this.replaceId(result.value);
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
}
