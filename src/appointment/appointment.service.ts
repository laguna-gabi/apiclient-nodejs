import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Appointment,
  AppointmentDocument,
  AppointmentStatus,
  Notes,
  NotesDocument,
  RequestAppointmentParams,
  ScheduleAppointmentParams,
  SetNotesParams,
} from '.';
import { Errors, ErrorType, EventType } from '../common';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class AppointmentService {
  constructor(
    @InjectModel(Appointment.name)
    private readonly appointmentModel: Model<AppointmentDocument>,
    @InjectModel(Notes.name)
    private readonly notesModel: Model<NotesDocument>,
    private eventEmitter: EventEmitter2,
  ) {}

  async request(params: RequestAppointmentParams): Promise<Appointment> {
    const result = await this.appointmentModel.findOneAndUpdate(
      {
        userId: new Types.ObjectId(params.userId),
        memberId: new Types.ObjectId(params.memberId),
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
      this.notifyNewAppointmentCreated({
        userId: result.value.userId,
        appointmentId: result.value._id,
      });
    }

    return result.value;
  }

  async get(id: string): Promise<Appointment> {
    return this.appointmentModel.findById({ _id: id }).populate('notes');
  }

  async schedule(params: ScheduleAppointmentParams): Promise<Appointment> {
    const result = (
      await this.appointmentModel.create({
        userId: new Types.ObjectId(params.userId),
        memberId: new Types.ObjectId(params.memberId),
        notBefore: params.notBefore,
        method: params.method,
        start: params.start,
        end: params.end,
        status: AppointmentStatus.scheduled,
      })
    ).toObject();

    result.id = new Types.ObjectId(result._id);
    delete result._id;

    this.notifyNewAppointmentCreated({
      userId: result.userId,
      appointmentId: result.id,
    });

    return result;
  }

  async end(id: string): Promise<Appointment> {
    return this.updateAppointment(id, {
      status: AppointmentStatus.done,
    });
  }

  async freeze(id: string): Promise<Appointment> {
    return this.updateAppointment(id, {
      status: AppointmentStatus.closed,
    });
  }

  async show(params): Promise<Appointment> {
    return this.updateAppointment(params.id, {
      noShow: {
        noShow: params.noShow,
        reason: params.reason,
      },
    });
  }

  async setNotes(params: SetNotesParams): Promise<void> {
    const existing = await this.appointmentModel.findById({
      _id: params.appointmentId,
    });

    if (!existing) {
      throw new Error(Errors.get(ErrorType.appointmentIdNotFound));
    }

    if (existing.notes) {
      await this.notesModel.findOneAndUpdate(
        { _id: existing.notes },
        { $set: { notes: params.notes, scores: params.scores } },
      );
    } else {
      const { id } = await this.notesModel.create(params);
      await this.appointmentModel.findOneAndUpdate(
        { _id: params.appointmentId },
        { $set: { notes: id } },
      );
    }
  }

  private async updateAppointment(id, setParams): Promise<Appointment> {
    const result = await this.appointmentModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(id),
      },
      {
        $set: setParams,
      },
      { upsert: false, new: true },
    );

    if (!result) {
      throw new Error(Errors.get(ErrorType.appointmentIdNotFound));
    }

    return result;
  }

  private notifyNewAppointmentCreated({
    userId,
    appointmentId,
  }: {
    userId: Types.ObjectId;
    appointmentId: string;
  }) {
    this.eventEmitter.emit(EventType.newAppointment, {
      userId,
      appointmentId,
    });
  }
}
