import { ContentKey } from '@argus/irisClient';
import { ClientSettings } from '../settings';

export class GetContentsParams {
  contentKey: ContentKey;
  recipientClient?: ClientSettings;
  senderClient?: ClientSettings;
  extraData?: ExtraData;
}

export class ExtraData {
  org?: { name: string };
  appointmentStart?: string;
  senderInitials?: string;
  gapMinutes?: string;
  appointmentTime?: string;
  chatLink?: string;
  scheduleLink?: string;
  dynamicLink?: string;
  assessmentName?: string;
  assessmentScore?: string;
}

export class FailureReason {
  message: string;
  stack: string;
}
