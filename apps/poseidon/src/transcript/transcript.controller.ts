import { StorageType } from '@argus/pandora';
import { PoseidonMessagePatterns, Transcript } from '@argus/poseidonClient';
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
    if (!transcript) {
      this.logger.error({ recordingId }, TranscriptController.name, this.getTranscript.name, {
        message: Errors.get(ErrorType.transcriptNotFound),
      });
      return;
    }
    const transcriptLink = await this.storageService.getDownloadUrl({
      storageType: StorageType.transcripts,
      memberId: transcript?.memberId,
      id: `${recordingId}.json`,
    });

    return { ...transcript, transcriptLink };
  }
}
