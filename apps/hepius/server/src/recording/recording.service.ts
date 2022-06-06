import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { isNil, omitBy } from 'lodash';
import { Model, Types } from 'mongoose';
import { v4 } from 'uuid';
import {
  Recording,
  RecordingDocument,
  UpdateRecordingParams,
  UpdateRecordingReviewParams,
} from '.';
import {
  ErrorType,
  Errors,
  EventType,
  IEventDeleteMember,
  LoggerService,
  deleteMemberObjects,
} from '../common';
import { ISoftDelete } from '../db';

@Injectable()
export class RecordingService {
  constructor(
    @InjectModel(Recording.name)
    private readonly recordingModel: Model<RecordingDocument> & ISoftDelete<RecordingDocument>,
    readonly logger: LoggerService,
  ) {}

  async updateRecording(updateRecordingParams: UpdateRecordingParams): Promise<Recording> {
    const {
      start,
      end,
      memberId,
      id,
      phone,
      answered,
      appointmentId,
      recordingType,
      consent,
      identityVerification,
      userId,
      journeyId,
    } = updateRecordingParams;

    const setParams = omitBy(
      {
        memberId: new Types.ObjectId(memberId),
        userId: new Types.ObjectId(userId),
        journeyId: new Types.ObjectId(journeyId),
        appointmentId: appointmentId ? new Types.ObjectId(appointmentId) : null,
        start,
        end,
        phone,
        answered,
        recordingType,
        consent,
        identityVerification,
      },
      isNil,
    );

    if (id) {
      const exists = await this.recordingModel.findOne({ id });
      if (exists && exists.memberId.toString() !== memberId) {
        throw new Error(Errors.get(ErrorType.recordingSameUserEdit));
      }
      const result = await this.recordingModel.findOneAndUpdate({ id }, setParams, {
        upsert: true,
        new: true,
        rawResult: true,
      });
      return result.value.toObject();
    } else {
      const result = await this.recordingModel.create({ ...setParams, id: v4() });
      return result.toObject();
    }
  }

  async getRecording({
    id,
    memberId,
    journeyId,
  }: {
    id: string;
    memberId: string;
    journeyId: string;
  }): Promise<Recording> {
    const recoding = await this.recordingModel.findOne({
      id,
      memberId: new Types.ObjectId(memberId),
      journeyId: new Types.ObjectId(journeyId),
    });
    if (!recoding) {
      throw new Error(Errors.get(ErrorType.recordingNotFound));
    }

    return recoding;
  }

  async getRecordings({
    memberId,
    journeyId,
  }: {
    memberId: string;
    journeyId: string;
  }): Promise<Recording[]> {
    return this.recordingModel.find({
      memberId: new Types.ObjectId(memberId),
      journeyId: new Types.ObjectId(journeyId),
    });
  }

  async updateRecordingReview(
    updateRecordingReviewParams: UpdateRecordingReviewParams,
  ): Promise<void> {
    const { recordingId, content, userId } = updateRecordingReviewParams;

    const recording = await this.recordingModel.findOne({ id: recordingId });

    if (!recording) {
      throw new Error(Errors.get(ErrorType.recordingNotFound));
    }

    const objectUserId = new Types.ObjectId(userId);

    // User cannot review own recording
    if (recording.userId.toString() === objectUserId.toString()) {
      throw new Error(Errors.get(ErrorType.recordingSameUser));
    }

    // Only user who wrote review can update it
    if (
      recording.review?.userId &&
      recording.review.userId.toString() !== objectUserId.toString()
    ) {
      throw new Error(Errors.get(ErrorType.recordingSameUserEdit));
    }

    if (recording.review) {
      await this.recordingModel.updateOne(
        { id: recordingId },
        {
          $set: {
            'review.userId': objectUserId,
            'review.content': content,
          },
        },
        { new: true, upsert: true },
      );
    } else {
      await this.recordingModel.findOneAndUpdate(
        { id: recordingId },
        {
          $set: {
            review: {
              userId: objectUserId,
              content,
              createdAt: null,
              updatedAt: null,
            },
          },
        },
        { new: true, upsert: true },
      );
    }
  }

  @OnEvent(EventType.onDeletedMember, { async: true })
  async deleteMemberRecording(params: IEventDeleteMember) {
    const data = {
      params,
      logger: this.logger,
      methodName: this.deleteMemberRecording.name,
      serviceName: RecordingService.name,
    };

    await deleteMemberObjects<Model<RecordingDocument> & ISoftDelete<RecordingDocument>>({
      model: this.recordingModel,
      ...data,
    });
  }
}
