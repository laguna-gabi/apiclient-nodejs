import { Transcript, TranscriptDocument } from '@argus/poseidonClient';
import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { EventType, IEventOnTranscriptFailed, IEventOnTranscriptTranscribed } from '../common';

@Injectable()
export class TranscriptService {
  constructor(
    @InjectModel(Transcript.name) private readonly transcriptModel: Model<TranscriptDocument>,
  ) {}

  async update(transcript: Transcript): Promise<Transcript> {
    return this.transcriptModel.findOneAndUpdate(
      { recordingId: transcript.recordingId },
      { $set: transcript },
      { upsert: true, new: true },
    );
  }

  async get(recordingId: string): Promise<Transcript | null> {
    return this.transcriptModel.findOne({ recordingId });
  }

  @OnEvent(EventType.onTranscriptTranscribed, { async: true })
  async test(params: IEventOnTranscriptTranscribed) {
    const { transcriptionId } = params;
    // get transcript and upload to s3
    // upadte status to done
    console.log({ transcriptionId });
  }

  @OnEvent(EventType.onTranscriptFailed, { async: true })
  async test1(params: IEventOnTranscriptFailed) {
    const { transcriptionId, failureReason } = params;
    // update status to error and failureReason
    console.log({ transcriptionId, failureReason });
  }
}
