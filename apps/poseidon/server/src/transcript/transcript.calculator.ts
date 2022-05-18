import { ConversationPercentage, Transcript, TranscriptDocument } from '@argus/poseidonClient';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { RevAiApiTranscript } from 'revai-node-sdk';
import { LoggerService } from '../common';
import { RevAI } from '../providers';

@Injectable()
export class TranscriptCalculator {
  constructor(
    @InjectModel(Transcript.name) private readonly transcriptModel: Model<TranscriptDocument>,
    private readonly logger: LoggerService,
    private readonly revAI: RevAI,
  ) {}

  async calculateConversationPercentage(transcriptionId: string): Promise<ConversationPercentage> {
    this.logger.info(
      { transcriptionId },
      TranscriptCalculator.name,
      this.calculateConversationPercentage.name,
    );
    const transcriptObject = await this.revAI.getTranscriptObject(transcriptionId);
    const { speakerATime, speakerBTime } = this.calculateSpeakersTime(transcriptObject);

    if (speakerATime === 0 && speakerBTime === 0) {
      return { speakerA: speakerATime, speakerB: speakerBTime, silence: 100 };
    }

    const endTime = this.calculateEndTime(transcriptObject);

    const speakerA = Math.round((100 * speakerATime) / endTime);
    const speakerB = Math.round((100 * speakerBTime) / endTime);
    const silence = 100 - speakerA - speakerB;

    return { speakerA, speakerB, silence };
  }

  private calculateSpeakersTime(transcriptObject: RevAiApiTranscript): {
    speakerATime: number;
    speakerBTime: number;
  } {
    let speakerATime = 0;
    let speakerBTime = 0;

    transcriptObject.monologues.forEach((monologue) => {
      monologue.elements.forEach((element) => {
        if (element.ts && element.end_ts) {
          monologue.speaker === 0
            ? (speakerATime += element.end_ts - element.ts)
            : (speakerBTime += element.end_ts - element.ts);
        }
      });
    });

    return { speakerATime, speakerBTime };
  }

  private calculateEndTime(transcriptObject: RevAiApiTranscript): number {
    return transcriptObject.monologues
      .pop()
      ?.elements.slice()
      .reverse()
      .find((element) => element.ts && element.end_ts).end_ts;
  }
}
