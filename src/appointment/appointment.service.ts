import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
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
import { BaseService, Errors, ErrorType, EventType } from '../common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as config from 'config';

@Injectable()
export class AppointmentService extends BaseService {
  private readonly APP_URL = config.get('hosts.app');

  constructor(
    @InjectModel(Appointment.name)
    private readonly appointmentModel: Model<AppointmentDocument>,
    @InjectModel(Notes.name)
    private readonly notesModel: Model<NotesDocument>,
    private eventEmitter: EventEmitter2,
  ) {
    super();
  }

  async request(params: RequestAppointmentParams): Promise<Appointment> {
    const result = await this.appointmentModel.findOneAndUpdate(
      {
        userId: params.userId,
        memberId: new Types.ObjectId(params.memberId),
        status: AppointmentStatus.requested,
      },
      {
        $set: {
          notBefore: params.notBefore,
          status: AppointmentStatus.requested,
        },
      },
      { upsert: true, new: true, rawResult: true },
    );

    if (result.lastErrorObject.upserted) {
      const { _id, userId } = result.value;
      return this.postNewAppointmentAction({
        userId,
        memberId: params.memberId,
        appointmentId: _id,
      });
    }

    return this.replaceId(result.value.toObject() as AppointmentDocument);
  }

  async get(id: string): Promise<Appointment> {
    const result = await this.appointmentModel.findById({ _id: id }).populate('notes');
    return this.replaceId(result);
  }

  async schedule(params: ScheduleAppointmentParams): Promise<Appointment> {
    const object = await this.appointmentModel.findOneAndUpdate(
      {
        userId: params.userId,
        memberId: new Types.ObjectId(params.memberId),
        status: { $ne: AppointmentStatus.done },
      },
      {
        $set: {
          userId: params.userId,
          memberId: new Types.ObjectId(params.memberId),
          method: params.method,
          start: params.start,
          end: params.end,
          status: AppointmentStatus.scheduled,
        },
      },
      { upsert: true, new: true, rawResult: true },
    );

    if (!object.lastErrorObject.updatedExisting) {
      return this.postNewAppointmentAction({
        userId: object.value.userId,
        memberId: params.memberId,
        appointmentId: object.value._id,
      });
    }

    return this.replaceId(object.value.toObject() as AppointmentDocument);
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
    const existing = await this.appointmentModel.findById({ _id: params.id });
    let result;

    if (!existing) {
      throw new Error(Errors.get(ErrorType.appointmentIdNotFound));
    }

    const update: any = { status: AppointmentStatus.done };
    if (params.noShow !== undefined) {
      update.noShow = params.noShow;
    }
    if (params.noShowReason !== undefined) {
      update.noShowReason = params.noShowReason;
    }

    if (params.notes === undefined) {
      result = await this.appointmentModel
        .findOneAndUpdate({ _id: params.id }, { $set: { ...update } }, { new: true })
        .populate('notes');
    } else if (params.notes === null) {
      if (existing.notes) {
        await this.notesModel.deleteOne({ _id: existing.notes });
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
      this.eventEmitter.emit(EventType.appointmentScoresUpdated, {
        memberId: existing.memberId,
        scores: params.notes.scores,
      });
    }

    return this.replaceId(result.toObject() as AppointmentDocument);
  }

  private async updateAppointment(id, setParams): Promise<Appointment> {
    const object = await this.appointmentModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(id),
      },
      {
        $set: setParams,
      },
      { upsert: false, new: true },
    );

    if (!object) {
      throw new Error(Errors.get(ErrorType.appointmentIdNotFound));
    }

    return this.replaceId(object.toObject());
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
    this.eventEmitter.emit(EventType.newAppointment, { userId, appointmentId });
    this.eventEmitter.emit(EventType.addUserToMemberList, { memberId, userId });

    const link = `${this.APP_URL}/${appointmentId.toString()}`;

    const result = await this.appointmentModel.findOneAndUpdate(
      { _id: appointmentId },
      { $set: { link } },
      { upsert: true, new: true, rawResult: true },
    );

    return this.replaceId(result.value.toObject() as AppointmentDocument);
  }

  async updateNotes(params: UpdateNotesParams): Promise<Notes | null> {
    const existing = await this.appointmentModel.findById({ _id: params.appointmentId });

    if (!existing) {
      throw new Error(Errors.get(ErrorType.appointmentIdNotFound));
    }

    if (params.notes === null) {
      if (existing.notes) {
        await this.notesModel.deleteOne({ _id: existing.notes });
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
}
