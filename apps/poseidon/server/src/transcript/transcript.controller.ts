import { StorageType } from '@argus/pandora';
import { PoseidonMessagePatterns, Speaker, Transcript } from '@argus/poseidonClient';
import { Controller } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { TranscriptService } from '.';
import { ErrorType, Errors, LoggerService } from '../common';
import { StorageService } from '../providers';

@Controller()
export class TranscriptController {
  constructor(
    private readonly transcriptService: TranscriptService,
    private readonly storageService: StorageService,
    private readonly logger: LoggerService,
  ) {}

  @MessagePattern(PoseidonMessagePatterns.getTranscript)
  async getTranscript(recordingId: string): Promise<Transcript> {
    const transcript = await this.transcriptService.get(recordingId);
    return this.buildResponse(recordingId, transcript, this.getTranscript.name);
  }

  @MessagePattern(PoseidonMessagePatterns.setTranscriptSpeaker)
  async setTranscriptSpeaker({
    recordingId,
    coach,
  }: {
    recordingId: string;
    coach: Speaker;
  }): Promise<Transcript> {
    const transcript = await this.transcriptService.setSpeaker({ recordingId, coach });
    return this.buildResponse(recordingId, transcript, this.setTranscriptSpeaker.name);
  }

  private async buildResponse(recordingId, transcript, methodName) {
    if (!transcript) {
      this.logger.error({ recordingId }, TranscriptController.name, methodName, {
        message: Errors.get(ErrorType.transcriptNotFound),
      });
      return;
    }
    const transcriptLink = await this.storageService.getDownloadUrl({
      storageType: StorageType.transcripts,
      memberId: transcript.memberId,
      id: `${recordingId}.json`,
    });

    return { ...transcript, transcriptLink };
  }
}
