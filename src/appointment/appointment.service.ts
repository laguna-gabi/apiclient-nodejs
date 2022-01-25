import { Injectable } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import * as config from 'config';
import { Model, Types } from 'mongoose';
import {
  Appointment,
  AppointmentDocument,
  AppointmentStatus,
  EndAppointmentParams,
  Notes,
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
  IEventMember,
  IEventOnDeletedMemberAppointments,
  IEventOnNewAppointment,
  IEventOnUpdatedAppointmentScores,
  IEventUnconsentedAppointmentEnded,
  LoggerService,
} from '../common';
import { isUndefined, omitBy } from 'lodash';

@Injectable()
export class AppointmentService extends BaseService {
  private readonly APP_URL = config.get('hosts.app');

  constructor(
    @InjectModel(Appointment.name)
    private readonly appointmentModel: Model<AppointmentDocument>,
    @InjectModel(Notes.name)
    private readonly notesModel: Model<NotesDocument>,
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

  async show(params): Promise<Appointment> {
    return this.updateAppointment(params.id, {
      noShow: {
        noShow: params.noShow,
        reason: params.reason,
      },
    });
  }

  async end(params: EndAppointmentParams): Promise<Appointment> {
    const existing = await this.appointmentModel.findById(new Types.ObjectId(params.id));
    if (!existing) {
      throw new Error(Errors.get(ErrorType.appointmentIdNotFound));
    }

    const { noShow, recordingConsent, id, noShowReason } = params;
    let result;
    const update: any = omitBy(
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
        .populate('notes');
    } else if (params.notes === null) {
      if (existing.notes) {
        await this.deleteNotes(existing.notes);
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
          .populate('notes');
        notesId = result._id;
      } else {
        const { _id } = await this.notesModel.create(params.notes);
        notesId = _id;
      }
      result = await this.appointmentModel
        .findOneAndUpdate({ _id: params.id }, { $set: update, notes: notesId }, { new: true })
        .populate('notes');
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

  async updateAppointment(id, setParams): Promise<Appointment> {
    const object = await this.appointmentModel.findByIdAndUpdate(
      new Types.ObjectId(id),
      { $set: setParams },
      { upsert: false, new: true },
    );

    if (!object) {
      throw new Error(Errors.get(ErrorType.appointmentIdNotFound));
    }

    return this.replaceId(object.toObject());
  }

  async delete(id: string, deletedBy: string): Promise<boolean> {
    const result = await this.appointmentModel.findById(new Types.ObjectId(id));
    if (!result) {
      throw new Error(Errors.get(ErrorType.appointmentIdNotFound));
    }
    const deletedByObject = new Types.ObjectId(deletedBy);
    await result.delete(deletedByObject);

    if (result.notes) {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      await this.deleteNotes(result.notes._id, deletedByObject);
    }

    return true;
  }

  private async deleteNotes(notes, deletedBy?: Types.ObjectId) {
    const notesResult = await this.notesModel.findOne({ _id: notes });
    if (notesResult) {
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

    const link = `${this.APP_URL}/${appointmentId.toString()}`;

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
        await this.deleteNotes(existing.notes);
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
  async deleteMemberAppointments(params: IEventMember) {
    this.logger.info(params, AppointmentService.name, this.deleteMemberAppointments.name);
    const { memberId } = params;
    const appointments = await this.appointmentModel.find({
      memberId: new Types.ObjectId(memberId),
    });
    for (let index = 0; index < appointments.length; index++) {
      if (appointments[index].notes) {
        await this.deleteNotes(appointments[index].notes);
      }
    }
    await this.appointmentModel.deleteMany({ memberId: new Types.ObjectId(memberId) });
    const eventParams: IEventOnDeletedMemberAppointments = { appointments };
    this.eventEmitter.emit(EventType.onDeletedMemberAppointments, eventParams);
  }
}
