import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Transcript, TranscriptDocument } from '.';

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
}
