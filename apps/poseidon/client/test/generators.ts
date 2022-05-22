import { generateId } from '@argus/pandora';
import { Speaker, Transcript, TranscriptStatus } from '../src';

export const generateTranscriptResponse = ({
  recordingId = generateId(),
  memberId = generateId(),
  transcriptionId = generateId(),
  status = TranscriptStatus.done,
  // eslint-disable-next-line max-len
  transcriptLink = 'https://d1ic17v34w4spl.cloudfront.net/public/dischargeInstructions/ae017845-c956-41e7-8334-64b474e0f40c.json',
  coach = Speaker.speakerA,
  conversationPercentage = {
    speakerA: 18,
    speakerB: 22,
    silence: 60,
  },
}: Partial<Transcript> = {}): Transcript => {
  return {
    recordingId,
    memberId,
    transcriptionId,
    status,
    transcriptLink,
    coach,
    conversationPercentage,
  };
};
