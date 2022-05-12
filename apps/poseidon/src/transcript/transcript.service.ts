import { StorageType } from '@argus/pandora';
import {
  ConversationPercentage,
  Speaker,
  Transcript,
  TranscriptDocument,
  TranscriptStatus,
} from '@argus/poseidonClient';
import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { v4 } from 'uuid';
import { TranscriptCalculator } from '.';
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
    private readonly transcriptCalculator: TranscriptCalculator,
    private readonly storageService: StorageService,
    private readonly revAI: RevAI,
    private readonly logger: LoggerService,
  ) {}

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
    this.logger.info(params, TranscriptService.name, this.handleTranscriptTranscribed.name);
    const { transcriptionId } = params;

    const conversationPercentage: ConversationPercentage =
      await this.transcriptCalculator.calculateConversationPercentage(transcriptionId);

    const { memberId, recordingId } = await this.transcriptModel.findOne({ transcriptionId });

    await this.uploadTranscript({ memberId, recordingId, transcriptionId });

    await this.transcriptModel.findOneAndUpdate(
      { transcriptionId },
      { $set: { conversationPercentage, status: TranscriptStatus.done } },
    );
  }

  @OnEvent(EventType.onTranscriptFailed, { async: true })
  async handleTranscriptFailed(params: IEventOnTranscriptFailed) {
    this.logger.info(params, TranscriptService.name, this.handleTranscriptFailed.name);
    const { transcriptionId, failureReason } = params;
    await this.transcriptModel.findOneAndUpdate(
      { transcriptionId },
      { $set: { status: TranscriptStatus.error, failureReason } },
    );
  }

  private async uploadTranscript({
    memberId,
    recordingId,
    transcriptionId,
  }: {
    memberId: string;
    recordingId: string;
    transcriptionId: string;
  }) {
    this.logger.info(
      { memberId, recordingId, transcriptionId },
      TranscriptService.name,
      this.uploadTranscript.name,
    );
    const transcriptText = await this.revAI.getTranscriptText(transcriptionId);
    const transcriptJson = this.createTranscriptJson(transcriptText);
    await Promise.all([
      this.storageService.uploadFile({
        storageType: StorageType.transcripts,
        memberId,
        id: recordingId,
        data: transcriptText,
      }),
      this.storageService.uploadFile({
        storageType: StorageType.transcripts,
        memberId,
        id: `${recordingId}.json`,
        data: transcriptJson,
      }),
    ]);
  }

  /**
   * we use '/\s\s+/g' to split where there are multiple spaces
   * each line look like this:
   *     'Speaker 1    00:00:36    Oh, it just.'
   * we split it to:
   *     ['Speaker 1', '00:00:36', 'Oh, it just.']
   */
  private createTranscriptJson(transcriptText: string): string {
    const transcript = transcriptText
      .split('\n')
      .map((line) => {
        const lineArray = line.split(/\s\s+/g);
        if (lineArray.length >= 3) {
          return {
            speaker: lineArray[0] === 'Speaker 0' ? Speaker.speakerA : Speaker.speakerB,
            time: this.getSecondsFromTime(lineArray[1]),
            text: lineArray[2],
            id: v4(), // the id on each object is used in the ui
          };
        }
      })
      .filter((element) => {
        return element !== undefined;
      });

    return JSON.stringify({ transcript });
  }

  // converts HH:MM:SS to number of seconds
  private getSecondsFromTime(time: string): number {
    const timeArray = time.split(':');
    return Number(timeArray[0]) * 60 * 60 + +timeArray[1] * 60 + Number(timeArray[2]);
  }
}
