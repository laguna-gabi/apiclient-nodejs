import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Appointment,
  AppointmentDocument,
  AppointmentStatus,
  CreateAppointmentParams,
  ScheduleAppointmentParams,
  // NoShowParams,
} from '.';
import { Errors, ErrorType } from '../common';

@Injectable()
export class AppointmentService {
  constructor(
    @InjectModel(Appointment.name)
    private readonly appointmentModel: Model<AppointmentDocument>,
  ) {}

  async insert(params: CreateAppointmentParams): Promise<Appointment> {
    return this.appointmentModel.findOneAndUpdate(
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
      { upsert: true, new: true },
    );
  }

  async get(id: string): Promise<Appointment> {
    return this.appointmentModel.findById({ _id: id });
  }

  async schedule(params: ScheduleAppointmentParams): Promise<Appointment> {
    return this.updateAppointment(params.id, {
      method: params.method,
      start: params.start,
      end: params.end,
      status: AppointmentStatus.scheduled,
    });
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
}
