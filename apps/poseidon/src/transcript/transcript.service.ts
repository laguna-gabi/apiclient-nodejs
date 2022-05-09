import { StorageType } from '@argus/pandora';
import { Transcript, TranscriptDocument } from '@argus/poseidonClient';
import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  EventType,
  IEventOnCreateTranscript,
  IEventOnTranscriptFailed,
  IEventOnTranscriptTranscribed,
  LoggerService,
} from '../common';
import { RevAI, StorageService } from '../providers';

@Injectable()
export class TranscriptService {
  constructor(
    @InjectModel(Transcript.name) private readonly transcriptModel: Model<TranscriptDocument>,
    private readonly logger: LoggerService,
    private readonly storageService: StorageService,
    private readonly revAI: RevAI,
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

  @OnEvent(EventType.onCreateTranscript, { async: true })
  async handleCreateTranscript(params: IEventOnCreateTranscript) {
    const { memberId, recordingId } = params;
    const recordingDownloadLink = await this.storageService.getDownloadUrl({
      storageType: StorageType.recordings,
      memberId,
      id: recordingId,
    });
    const transcriptionId = await this.revAI.createTranscript(recordingDownloadLink);
    this.logger.info(
      { recordingId, memberId, transcriptionId },
      TranscriptService.name,
      this.handleCreateTranscript.name,
    );
    await this.transcriptModel.create({ recordingId, memberId, transcriptionId });
  }

  @OnEvent(EventType.onTranscriptTranscribed, { async: true })
  async handleTranscriptTranscribed(params: IEventOnTranscriptTranscribed) {
    const { transcriptionId } = params;
    // get transcript and upload to s3
    // upadte status to done
    console.log({ transcriptionId });
  }

  @OnEvent(EventType.onTranscriptFailed, { async: true })
  async handleTranscriptFailed(params: IEventOnTranscriptFailed) {
    const { transcriptionId, failureReason } = params;
    // update status to error and failureReason
    console.log({ transcriptionId, failureReason });
  }
}
